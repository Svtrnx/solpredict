use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarketCategory {
    Politics,
    War,
    Finance,
    Sports,
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
        MarketCategory::Finance => &[
            "bloomberg.com",
            "reuters.com/markets",
            "wsj.com",
            "ft.com",
            "marketwatch.com",
            "cnbc.com",
            "finance.yahoo.com",
            "investing.com",
            "seekingalpha.com",
            "sec.gov",
            "federalreserve.gov",
            "imf.org",
            "tradingview.com",
            "coindesk.com",
            "cointelegraph.com",
        ],
        MarketCategory::Sports => &[
            "espn.com",
            "si.com",
            "bleacherreport.com",
            "bbc.com/sport",
            "skysports.com",
            "theguardian.com/sport",
            "nytimes.com/section/sports",
            "reuters.com/sports",
            "apnews.com/hub/sports",
            "cbssports.com",
            "nbcsports.com",
            "yahoo.com/sports",
            "sports.yahoo.com",
            "foxsports.com",
            "goal.com",
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
		• stock prices, crypto prices, market indices, company earnings
		If the input is primarily military/kinetic/finance → output {"accept": false, "reason": "out of category", "proposals": []}.
		"#
        }
        MarketCategory::War => {
            r#"
        CATEGORY ENFORCEMENT (HARD):
        - This job runs under category = War.
        - ACCEPT topics primarily about:
        • kinetic military actions (air/drone/missile strikes, shelling, ground assaults)
        • troop movements/deployments/stationing (including sending troops/army)
        • territorial gains/losses, frontline changes
        • ceasefires, military withdrawals, prisoner exchanges tied to combat
        • weapons deliveries/arrivals as battlefield events
        - REJECT topics that are primarily about:
        • sanctions/export controls/trade restrictions/visa bans (unless directly tied to military action)
        • purely diplomatic statements not tied to military events
        • elections/legislation/appointments (unless directly about military command)
        • stock prices, crypto prices, market indices, company earnings
        If the input is primarily sanctions/diplomacy/politics/finance → output {"accept": false, "reason": "out of category", "proposals": []}.
        "#
        }
        MarketCategory::Finance => {
            r#"
        CATEGORY ENFORCEMENT (HARD):
        - This job runs under category = Finance.
        - ACCEPT ONLY topics primarily about:
        • stock prices, equity indices (S&P 500, NASDAQ, Dow Jones, etc.)
        • cryptocurrency prices (Bitcoin, Ethereum, altcoins)
        • forex rates, currency values, exchange rates
        • commodity prices (gold, oil, natural gas, wheat, etc.)
        • interest rates, central bank decisions, monetary policy
        • company earnings, revenue, IPOs, mergers & acquisitions
        • economic indicators (GDP, inflation, unemployment, CPI, etc.)
        • market performance, trading volumes, market caps
        • financial regulations directly affecting markets/prices
        - REJECT topics that are primarily about:
        • political elections, legislation, diplomatic relations (unless directly tied to market impact)
        • military actions, wars, conflicts (unless directly tied to market impact)
        • general news without clear financial/market implications
        If the input is primarily politics/military/general-news → output {"accept": false, "reason": "out of category", "proposals": []}.
        "#
        }
        MarketCategory::Sports => {
            r#"
        CATEGORY ENFORCEMENT (HARD):
        - This job runs under category = Sports.
        - ACCEPT ONLY topics primarily about:
        • sports games, matches, tournaments, championships
        • team performance, wins, losses, standings, playoffs
        • player performance, stats, records, achievements
        • player transfers, trades, signings, contract extensions
        • injuries, suspensions, disciplinary actions
        • coaching changes, managerial decisions
        • tournament outcomes, qualification, elimination
        • awards, honors, Hall of Fame inductions
        • individual sports events (tennis, golf, boxing, UFC, etc.)
        • Olympic events, World Cup, major championships
        - REJECT topics that are primarily about:
        • political statements by athletes (unless directly tied to sports event)
        • financial aspects not directly related to sports outcomes
        • off-field personal life without sports impact
        • entertainment/celebrity news unrelated to sports performance
        If the input is primarily politics/finance/entertainment → output {"accept": false, "reason": "out of category", "proposals": []}.
        "#
        }
    }
}
