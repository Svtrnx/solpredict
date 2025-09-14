use regex::Regex;
use serde_json::{Value, Map};

pub fn normalize_obj_to_json(s: &str) -> String {
    let re_keys = Regex::new(r"([{\s,])([A-Za-z_][A-Za-z0-9_]*)\s*:").unwrap();
    let step1 = re_keys.replace_all(s, "$1\"$2\":").to_string();
    let step2 = step1.replace('\'', "\"");
    let re_percent = Regex::new(r":\s*([0-9]+(?:\.[0-9]+)?)\s*%").unwrap();
    re_percent.replace_all(&step2, ": \"$1%\"").to_string()
}

pub fn parse_probability_value(obj: &Map<String, Value>) -> Option<f64> {
    let v = obj.get("probability")?;
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => {
            let re_num = Regex::new(r"([0-9]+(?:\.[0-9]+)?)").unwrap();
            re_num.captures(s)
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<f64>().ok())
        }
        _ => None,
    }
}

pub fn extract_last_probability(text: &str) -> Option<(String, Value, f64)> {
    let re_obj = Regex::new(r"(?is)\{[^{}]*\bprobability\b[^{}]*\}").unwrap();

    let mut last_raw: Option<String> = None;
    let mut last_val: Option<Value> = None;
    let mut last_num: Option<f64> = None;

    for m in re_obj.find_iter(text) {
        let raw = m.as_str();

        let parsed = serde_json::from_str::<Value>(raw)
            .or_else(|_| {
                let fixed = normalize_obj_to_json(raw);
                serde_json::from_str::<Value>(&fixed)
            });
        let Ok(val) = parsed else { continue };

        if let Value::Object(map) = &val {
            if map.contains_key("probability") {
                if let Some(p) = parse_probability_value(map) {
                    last_raw = Some(raw.to_string());
                    last_val = Some(val);
                    last_num = Some(p);
                }
            }
        }
    }

    match (last_raw, last_val, last_num) {
        (Some(r), Some(v), Some(n)) => Some((r, v, n)),
        _ => None,
    }
}
