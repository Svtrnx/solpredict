use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarketCategory {
    Politics,
    War,
}

pub fn trusted_sources(cat: MarketCategory) -> &'static [&'static str] {
    match cat {
        MarketCategory::Politics => &[
            "reuters.com",
            "apnews.com",
            "axios.com",
            "propublica.org",
            "factcheck.org",
            "allsides.com",
            "defense.gov",
            "whitehouse.gov",
            "state.gov",
            "bbc.com",
            "nytimes.com",
            "theguardian.com",
            "ap.org",
            "bloomberg.com",
            "washingtonpost.com",
        ],
        MarketCategory::War => &[
            "understandingwar.org",
            "defenseone.com",
            "janes.com",
            "military.com",
            "foreignpolicy.com",
            "thedrive.com/the-war-zone",
            "reuters.com/defense",
            "bbc.com/news/world",
            "defensenews.com",
            "globalsecurity.org",
        ],
    }
}

pub fn category_rules(cat: MarketCategory) -> &'static str {
    match cat {
        MarketCategory::Politics => {
            r#"
		CATEGORY ENFORCEMENT (HARD):
		- This job runs under category = Politics.
		- ACCEPT ONLY topics primarily about:
		• sanctions, export controls, trade restrictions, tariffs, visa bans
		• diplomacy, treaties, negotiations, summits, official statements
		• elections, legislation, executive orders, appointments, cabinet changes
		- REJECT topics that are primarily about:
		• kinetic military actions (air/drone/missile strikes, shelling, battles)
		• troop movements, territorial control, battlefield outcomes
		• weapons deliveries/arrivals as battlefield events
		If the input is primarily military/kinetic → output {"accept": false, "reason": "out of category", "proposals": []}.
		"#
        }
        MarketCategory::War => {
            r#"
		CATEGORY ENFORCEMENT (HARD):
		- This job runs under category = War.
		- ACCEPT ONLY topics primarily about:
		• kinetic military actions (air/drone/missile strikes, shelling, ground assaults)
		• troop movements/deployments, territorial gains/losses, frontline changes
		• ceasefires, military withdrawals, prisoner exchanges tied to combat
		- REJECT topics that are primarily about:
		• sanctions/export controls/trade restrictions/visa bans
		• purely diplomatic statements not tied to military events
		• elections/legislation/appointments
		If the input is primarily sanctions/diplomacy/politics → output {"accept": false, "reason": "out of category", "proposals": []}.
		"#
        }
    }
}
