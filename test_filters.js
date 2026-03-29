const extractQueryIntent = (text) => {
    if (!text) return { yearOfStudy: null, keywords: [], cgpaFilter: null, placementWillingness: null };

    // 1. Normalize input
    let normalized = text.toLowerCase().trim();
    let yearOfStudy = null;
    let cgpaFilter = null;
    let placementWillingness = null;

    // 2. CGPA Detection (above/below/greater than etc)
    const aboveMatch = normalized.match(/(?:above|more than|greater than|>|>=)\s*(\d+(\.\d+)?)/i);
    const belowMatch = normalized.match(/(?:below|less than|smaller than|<|<=)\s*(\d+(\.\d+)?)/i);
    
    if (aboveMatch) {
        cgpaFilter = { $gte: parseFloat(aboveMatch[1]) };
        normalized = normalized.replace(aboveMatch[0], ' ');
    } else if (belowMatch) {
        cgpaFilter = { $lte: parseFloat(belowMatch[1]) };
        normalized = normalized.replace(belowMatch[0], ' ');
    }

    // 3. Year Detection
    const yearMatch = normalized.match(/(\d)(?:st|nd|rd|th)?\s*year/i);
    if (yearMatch) {
        yearOfStudy = parseInt(yearMatch[1]);
        normalized = normalized.replace(yearMatch[0], ' ');
    } else {
        const yearMappers = {
            'first year': 1, 'second year': 2, 'third year': 3, 'fourth year': 4, 'final year': 4
        };
        for (const [phrase, year] of Object.entries(yearMappers)) {
            if (normalized.includes(phrase)) {
                yearOfStudy = year;
                normalized = normalized.replace(phrase, ' ');
                break;
            }
        }
    }

    // 4. Placement Intent
    if (normalized.match(/placement ready|placed|ready for placement|willing for placement/i)) {
        placementWillingness = 'yes';
        normalized = normalized.replace(/placement ready|placed|ready for placement|willing for placement/i, ' ');
    }

    // 5. Keyword Extraction
    const fillerWords = ["students", "student", "who", "with", "and", "the", "in", "like", "for", "matching", "having", "is", "are", "cgpa", "year", "placement", "willing", "ready", "skill", "skills", "knowing", "above", "below", "more", "than", "greater", "less", "of", "all"];
    
    const keywords = normalized.split(/[\s,]+/).map(word => word.trim()).filter(word => word.length > 1 && !fillerWords.includes(word));

    return { yearOfStudy, keywords, cgpaFilter, placementWillingness };
};

const simulateQuery = (reqBody) => {
    const { query, year, cgpa, placement, skill } = reqBody;
    const intent = extractQueryIntent(query || '');
    const { yearOfStudy: textYear, keywords, cgpaFilter: textCgpaFilter, placementWillingness: textPlacement } = intent;

    const searchFields = ['firstName', 'lastName', 'rollNumber', 'skills', 'technicalSkills', 'technicalSkill', 'hobbies', 'hobby', 'sports', 'clubs', 'interests', 'interest', 'achievements', 'certifications', 'programmingLanguages', 'address', 'events', 'tools', 'interestedDomain', 'prefLocation'];

    let andConditions = [];

    // Prioritization logic: Query text overrides Dropdown filters
    const finalYear = textYear || (year && year !== 'All' ? year : null);
    if (finalYear) andConditions.push({ yearOfStudy: Number(finalYear) });

    let finalCgpaFilter = textCgpaFilter;
    if (!finalCgpaFilter && cgpa && cgpa !== 'All') finalCgpaFilter = { $gte: parseFloat(cgpa) };
    if (finalCgpaFilter) andConditions.push({ cgpa: finalCgpaFilter });

    const finalPlacement = textPlacement || (placement && placement !== 'All' ? (placement === 'Interested' ? 'yes' : 'no') : null);
    if (finalPlacement) andConditions.push({ placementWillingness: { $regex: new RegExp(finalPlacement, 'i') } });

    let skillTerms = [...keywords];
    if (skill && skill !== 'All') skillTerms.push(skill);

    if (skillTerms.length > 0) {
        const pattern = skillTerms.join("|");
        const regex = new RegExp(pattern, 'i');
        const orSkillMatches = searchFields.map(field => ({ [field]: { $regex: regex } }));
        andConditions.push({ $or: orSkillMatches });
    }

    let mongoQuery = {};
    if (andConditions.length > 0) {
        mongoQuery = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];
    }
    return mongoQuery;
};

// --- Test Cases ---
console.log("--- TEST 1: Dropdown filters ONLY (Empty Search Bar) ---");
const test1 = simulateQuery({ query: "", year: "3", cgpa: "8", placement: "Interested", skill: "React" });
console.log(JSON.stringify(test1, null, 2));

console.log("\n--- TEST 2: NLP Query overrides dropdowns (Conflict Scenario) ---");
// Dropdown says CGPA 7, but query says above 9. Query must win (Requirement 9).
const test2 = simulateQuery({ query: "above 9 cgpa in 4th year", year: "1", cgpa: "7", placement: "All", skill: "All" });
console.log(JSON.stringify(test2, null, 2));

console.log("\n--- TEST 3: Hybrid Search (Skills in search bar + Filter list) ---");
const test3 = simulateQuery({ query: "web development", year: "All", cgpa: "All", placement: "All", skill: "Java" });
console.log(JSON.stringify(test3, null, 2));
