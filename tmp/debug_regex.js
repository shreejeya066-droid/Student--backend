
const text = "cgpaabove8.0 in 3rd year";
const aboveCgpaRegex = /(?:above|more than|greater than|>|>=|above c\.?g\.?p\.?a\.?|cgpa\s*above|cgpaabove)\s*(\d+(\.\d+)?)|(\d+(\.\d+)?)\s*(?:c\.?g\.?p\.?a\.?|grade|score)/i;
const match = text.match(aboveCgpaRegex);
if (match) {
    console.log("MATCH FOUND");
    console.log("Full match:", match[0]);
    console.log("Value:", match[1] || match[3]);
} else {
    console.log("NO MATCH");
}
