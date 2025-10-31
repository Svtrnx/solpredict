use anyhow::{Result, anyhow};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::usecases::market_category::{MarketCategory, category_rules, trusted_sources};

#[derive(Debug, Serialize)]
struct PplxRequest<'a> {
    model: &'a str,
    stream: bool,
    temperature: u8,
    top_p: f32,
    max_tokens: u32,
    disable_search: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    language_preference: Option<&'a str>,
    response_format: ResponseFormat<'a>,
    messages: Vec<PplxMsg<'a>>,
}

#[derive(Debug, Deserialize)]
struct YesNoSchema {
    answer: String, // "YES" | "NO"
}

#[derive(Debug, Serialize)]
struct PplxMsg<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Serialize)]
struct ResponseFormat<'a> {
    #[serde(rename = "type")]
    r#type: &'a str,
    json_schema: JsonSchema<'a>,
}

#[derive(Debug, Serialize)]
struct JsonSchema<'a> {
    name: &'a str,
    schema: serde_json::Value,
    strict: bool,
}

// ---- response Perplexity

#[derive(Debug, Deserialize)]
struct PplxChatCompletion {
    choices: Vec<PplxChoice>,
}

#[derive(Debug, Deserialize)]
struct PplxChoice {
    message: PplxChoiceMsg,
}

#[derive(Debug, Deserialize)]
struct PplxChoiceMsg {
    role: String,
    content: String,
}

// ---- scheme market_norm_v1

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct MarketNormV8 {
    pub accept: bool,
    #[serde(default)]
    pub reason: String,
    pub proposals: Vec<Proposal>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Proposal {
    pub topic: String,
    pub description: String,
    pub criteria: String,
    pub end_time_utc: String,
    pub accepted_sources: Vec<String>,
    #[serde(rename = "shortText")]
    pub short_text: String,
}

pub struct PerplexityClient {
    http: reqwest::Client,
    api_key: String,
    endpoint: String,
}

impl PerplexityClient {
    pub fn new(api_key: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .expect("reqwest client");
        Self {
            http,
            api_key,
            endpoint: "https://api.perplexity.ai/chat/completions".into(),
        }
    }

    pub async fn normalize_market(
        &self,
        user_query: &str,
        category: MarketCategory,
    ) -> Result<MarketNormV8> {
        let srcs = trusted_sources(category);
        let sources_json = serde_json::to_string(&srcs).unwrap();
        let rules = category_rules(category);

        let cat_hint = match category {
            MarketCategory::Politics => "Politics",
            MarketCategory::War => "War",
            MarketCategory::Finance => "Finance",
            MarketCategory::Sports => "Sports",
        };

        let system = format!(
            r#"You normalize the user's question into market specs only.
                {rules}
                Output ONLY JSON per schema. No extra text.

                [LANGUAGE mandatory]
                - The raw_question MUST be in English.
                - If the question is not English → {{"accept": false, "reason": "Non-English question", "proposals": []}}
                - All output fields (topic, shortText, description, criteria) MUST be in English only.

                [QUESTION mandatory]
                - Rewrite to a proper yes/no.
                - 'topic' and 'shortText' MUST start with Will/Did/Has/Is/Are/Does and end with '?'.

                [ALTERNATIVES when accept=true]
                - Produce EXACTLY 3 faithful, distinct proposals (vary time window / actor / scope).
                - First mirrors the core action (e.g., "sanctions" stays "sanctions").

                [TIME UTC]
                - Parse raw_question.
                - today → end_time_utc=23:59:59Z today
                - tomorrow → 23:59:59Z tomorrow
                - explicit date → that date 23:59:59Z
                - none → default to 23:59:59Z NEXT UTC day

                [ACTOR remap]
                - If an individual is named, remap to the competent authority based on the ACTION TYPE:
                • Sanctions/trade restrictions → White House / U.S. Treasury (OFAC) / State Dept
                • Military strikes/operations → DoD / U.S. Military / Pentagon / White House
                • Troop deployments/movements → DoD / Pentagon / White House / U.S. Military
                • Weapons deliveries → DoD / State Dept / White House
                - Normalize country names (e.g., "Columbia"→"Colombia").
                - Keep the CORE ACTION from raw_question (troops→troops, sanctions→sanctions, strikes→strikes).

                [EVIDENCE policy]
                - Use precise verbs in description/criteria: announced/confirmed/signed/imposed/issued/delivered/arrived/conducted.
                - Counts: official posts/releases or on-image text from official posts.
                - Not count: rumors/intent/in-transit/link previews/unverified social.

                [CRITERIA markdown mandatory]
                - Provide 'criteria' with "Resolution criteria" and bullet points (*) concise & unambiguous.

                [SOURCES]
                - Pick >=7 most-relevant from {s}; do not add others.
            "#,
            s = sources_json,
            rules = rules
        );

        self.normalize_market_impl(&system, user_query, Some(cat_hint))
            .await
    }

    async fn normalize_market_impl(
        &self,
        system_prompt: &str,
        user_query: &str,
        category_hint: Option<&str>,
    ) -> Result<MarketNormV8> {
        let schema: serde_json::Value = serde_json::json!({
          "type": "object",
          "properties": {
            "accept": { "type": "boolean" },
            "reason": { "type": "string", "maxLength": 240 },
            "proposals": {
              "type": "array",
              "minItems": 0,
              "maxItems": 3,
              "items": {
                "type": "object",
                "properties": {
                  "topic": { "type": "string" },
                  "description": { "type": "string" },
                  "criteria": { "type": "string" },
                  "end_time_utc": { "type": "string" },
                  "accepted_sources": {
                    "type": "array",
                    "minItems": 2,
                    "items": { "type": "string" }
                  },
                  "shortText": { "type": "string", "maxLength": 120 }
                },
                "required": ["topic", "description", "criteria", "end_time_utc", "accepted_sources", "shortText"],
                "additionalProperties": false
              }
            }
          },
          "required": ["accept", "proposals"],
          "additionalProperties": false
        });

        let user_payload = serde_json::json!({
            "category": category_hint.unwrap_or("Politics"),
            "raw_question": user_query
        });
        let user_str = user_payload.to_string();

        let req = PplxRequest {
            model: "sonar",
            stream: false,
            temperature: 0,
            top_p: 0.1,
            max_tokens: 2000,
            disable_search: true,
            language_preference: Some("en"),
            response_format: ResponseFormat {
                r#type: "json_schema",
                json_schema: JsonSchema {
                    name: "market_norm_v1",
                    schema,
                    strict: true,
                },
            },
            messages: vec![
                PplxMsg {
                    role: "system",
                    content: system_prompt,
                },
                PplxMsg {
                    role: "user",
                    content: &user_str,
                },
            ],
        };

        let resp = self
            .http
            .post(&self.endpoint)
            .header(CONTENT_TYPE, "application/json")
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .json(&req)
            .send()
            .await
            .map_err(|e| anyhow!("perplexity send error: {e}"))?;

        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();

        // Logging
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&body_text) {
            if let Some(u) = v.get("usage") {
                tracing::info!(target: "perplexity", usage = %u, "PPLX usage");
                if let (Some(pt), Some(ct), Some(tt)) = (
                    u.get("prompt_tokens").and_then(|x| x.as_u64()),
                    u.get("completion_tokens").and_then(|x| x.as_u64()),
                    u.get("total_tokens").and_then(|x| x.as_u64()),
                ) {
                    tracing::info!(target: "perplexity",
                        prompt_tokens = pt,
                        completion_tokens = ct,
                        total_tokens = tt,
                        "PPLX usage (numbers)"
                    );
                }
            }
        }

        if !status.is_success() {
            return Err(anyhow!("perplexity http {}: {}", status, body_text));
        }

        let body: PplxChatCompletion = serde_json::from_str(&body_text)
            .map_err(|e| anyhow!("perplexity parse error: {e}. Raw: {}", body_text))?;

        let first = body
            .choices
            .get(0)
            .ok_or_else(|| anyhow!("no choices from perplexity"))?;

        let norm: MarketNormV8 = serde_json::from_str(&first.message.content).map_err(|e| {
            anyhow!(
                "invalid market_norm_v1 content: {e}. Raw: {}",
                first.message.content
            )
        })?;

        Ok(norm)
    }

    pub async fn resolve_yes_no_sonar_pro(
        &self,
        topic: &str,
        description: &str,
        criteria_md: &str,
        end_time_utc: &str,          // "YYYY-MM-DD HH:MM:SS+00"
        accepted_sources: &[String], // allowlisted domains
    ) -> Result<(String, i16)> {
        let system_msg = "Return ONLY a JSON object matching the schema. No extra text.";
        let user_msg = format!(
            "Topic:\n{{{topic}}}\n\nDescription:\n{{{description}}}\n\nResolution criteria (Markdown):\n{{{criteria}}}\n\nResolve strictly by {{{end_time}}} (UTC+0). Use ONLY content from the allowlisted domains. If no qualifying confirmation exists by the deadline per the rules above, return NO. Output must match the schema.",
            topic = topic,
            description = description,
            criteria = criteria_md,
            end_time = end_time_utc
        );

        let payload = serde_json::json!({
          "model": "sonar-pro",
          "stream": false,
          "temperature": 0,
          "top_p": 0.1,
          "max_tokens": 10,
          "enable_search_classifier": true,
          "response_format": {
            "type": "json_schema",
            "json_schema": {
              "name": "resolver_output",
              "schema": {
                "type": "object",
                "properties": {
                  "answer": { "type": "string", "enum": ["YES", "NO"] }
                },
                "required": ["answer"],
                "additionalProperties": false
              },
              "strict": true
            }
          },
          "messages": [
            { "role": "system", "content": system_msg },
            { "role": "user",   "content": user_msg }
          ],
          "search_domain_filter": accepted_sources,
          "web_search_options": { "search_context_size": "low" }
        });

        let resp = self
            .http
            .post(&self.endpoint)
            .header(CONTENT_TYPE, "application/json")
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow!("perplexity request failed: {e}"))?;

        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();

        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&body_text) {
            if let Some(u) = v.get("usage") {
                tracing::info!(target: "perplexity", usage = %u, "PPLX usage sonar-pro");
            }
        }

        if !status.is_success() {
            return Err(anyhow!("perplexity http {}: {}", status, body_text));
        }

        let body: PplxChatCompletion = serde_json::from_str(&body_text)
            .map_err(|e| anyhow!("perplexity parse error: {e}. Raw: {}", body_text))?;

        let first = body
            .choices
            .get(0)
            .ok_or_else(|| anyhow!("no choices from perplexity"))?;

        let parsed: YesNoSchema = serde_json::from_str(&first.message.content)
            .map_err(|e| anyhow!("invalid YES/NO schema: {e}. Raw: {}", first.message.content))?;

        let mapped = match parsed.answer.as_str() {
            "YES" => 0,
            "NO" => 1,
            other => return Err(anyhow!("unexpected answer: {}", other)),
        };

        Ok((parsed.answer, mapped))
    }
}
