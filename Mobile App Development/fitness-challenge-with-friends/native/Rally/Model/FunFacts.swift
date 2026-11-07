import Foundation

/** Small true things about bodies and sport. One a day, with more a tap away. */
nonisolated enum FunFacts {
    static let all = [
        "Your heart beats about 100,000 times a day.",
        "The human body has more than 600 muscles.",
        "The gluteus maximus, the one you sit on, is the largest muscle in your body.",
        "Taking a single step uses around 200 muscles.",
        "A mile of walking is roughly 2,000 steps.",
        "A marathon is 26.2 miles.",
        "The \"10,000 steps a day\" goal began as a slogan for a Japanese pedometer in the 1960s.",
        "The World Health Organization suggests at least 150 minutes of moderate activity a week for adults.",
        "Every bit of movement counts toward your week, even a few minutes at a time.",
        "Your heart is a muscle. Regular exercise makes it stronger and more efficient.",
        "Sweat itself has almost no smell. The odor comes from bacteria on your skin.",
        "More than half of your body is water.",
        "That ache a day or two after a hard workout has a name: delayed onset muscle soreness.",
        "Bones rebuild themselves all your life, and weight-bearing exercise helps keep them strong.",
        "Regular physical activity is linked to better sleep.",
        "Exercise releases endorphins, which can lift your mood.",
        "Humans are among the best long-distance runners in the animal kingdom, partly because we cool down by sweating.",
        "The treadmill was first used in English prisons in the 1800s, as hard labor.",
        "The word \"gymnasium\" comes from ancient Greece, where athletes trained and competed without clothes.",
        "The first modern Olympic Games were held in Athens in 1896.",
        "The Tour de France was first raced in 1903.",
        "A bicycle is one of the most energy-efficient ways a person can travel.",
        "Yoga began in ancient India and has been practiced for thousands of years.",
        "Your feet hold about a quarter of all the bones in your body.",
    ]

    /** The same fact all day, a different one tomorrow. */
    static func today() -> Int {
        let day = Calendar.current.ordinality(of: .day, in: .era, for: .now) ?? 0
        return day % all.count
    }
}
