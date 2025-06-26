import { readFile, writeFile } from "fs/promises";

let issueRaw = "";
for await (const chunk of process.stdin) {
  issueRaw += chunk;
}

const issue = JSON.parse(issueRaw);
const issueNumber = issue.number;

const getField = (id) => {
  const patterns = [
    new RegExp(
      `(?:^|\\n)\\s*### ${id.replace(
        /[-]/g,
        "[-]"
      )}\\n([\\s\\S]*?)(?=\\n### |$)`,
      "i"
    ),
    new RegExp(
      `### ${id.replace(/[-]/g, "[-]")}\\n([\\s\\S]*?)(?=\\n### |$)`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = issue.body.match(pattern);
    if (match) {
      const result = match[1].trim();
      console.log(`Found ${id}: "${result}"`);
      return result;
    }
  }

  console.log(`Field "${id}" not found in issue body`);
  return "";
};

const getCheckbox = (id, label) => {
  const re = new RegExp(`- \\[([ xX])\\] ${label}`);
  const f = issue.body.match(re);
  return f && f[1] !== " " ? true : false;
};

const findInsertionPoint = (sectionContent, username) => {
  const tableRegex = /<table>[\s\S]*?<\/table>/g;
  const tables = sectionContent.match(tableRegex) || [];

  const existingEntries = tables
    .map((table) => {
      const usernameMatch = table.match(/<a href="[^"]*">([^<]+)<\/a>/);
      return usernameMatch ? usernameMatch[1] : "";
    })
    .filter((name) => name);

  let insertionIndex = 0;
  for (let i = 0; i < existingEntries.length; i++) {
    if (username.toLowerCase() < existingEntries[i].toLowerCase()) {
      insertionIndex = i;
      break;
    }
    insertionIndex = i + 1;
  }

  return { insertionIndex, totalEntries: existingEntries.length };
};

const autoConvertChecked = getCheckbox(
  "auto-convert",
  "I want to automatically add it"
);
if (!autoConvertChecked) process.exit(0);

const dotfilesUrl = getField("Dotfiles URL");
const appCategory = getField("DE or WM");
const description = getField("Description");
const redditUrl = getField("Reddit URL \\(optional\\)");
const image = getField("Preview Image");

const username = dotfilesUrl
  .replace(/https:\/\/github.com\//, "")
  .split("/")[0];
const imgMatch = image.match(/!\[.*?\]\((.*?)\)/);
const imgUrl = imgMatch ? imgMatch[1] : "";

const section = appCategory.replace(/ /g, "");
const readmePath = "README.md";
const readme = await readFile(readmePath, "utf8");
const sectionHeader = `# ${section}`;
const sectionIndex = readme.indexOf(sectionHeader);
if (sectionIndex === -1) process.exit(1);
const nextSection = readme.indexOf("# ", sectionIndex + 1);
const sectionContent = readme.slice(
  sectionIndex,
  nextSection === -1 ? undefined : nextSection
);
const beforeSection = readme.slice(0, sectionIndex);
const afterSection = nextSection === -1 ? "" : readme.slice(nextSection);

const table = `<table>\n  <tr>\n    <td>\n      <a href=\"${dotfilesUrl}\">${username}</a> - ${description}\n    </td>\n  </tr>\n  <tr>\n    <td>\n      <a href=\"${
  redditUrl || "#"
}\">\n        <img src=\"${imgUrl}\" alt=\"reddit post\"/>\n      </a>\n    </td>\n  </tr>\n</table>\n\n`;

const { insertionIndex } = findInsertionPoint(sectionContent, username);

const tableRegex = /<table>[\s\S]*?<\/table>/g;
const existingTables = sectionContent.match(tableRegex) || [];

let newSectionContent = sectionHeader + "\n\n";
for (let i = 0; i < existingTables.length; i++) {
  if (i === insertionIndex) {
    newSectionContent += table;
  }
  newSectionContent += existingTables[i] + "\n\n";
}

if (insertionIndex >= existingTables.length) {
  newSectionContent += table;
}

const newReadme = beforeSection + newSectionContent + afterSection;

await writeFile(readmePath, newReadme, "utf8");

console.log("=== Extraction Results ===");
console.log(`Username: "${username}"`);
console.log(`Section: "${section}"`);
console.log(`Description: "${description}"`);
console.log(`Dotfiles URL: "${dotfilesUrl}"`);
console.log(`Reddit URL: "${redditUrl || "N/A"}"`);
console.log(`Image URL: "${imgUrl}"`);
console.log("=========================");

console.log(
  `✅ Updated ${readmePath} with ${username}'s dotfiles for ${section}`
);
console.log(`📝 Description: ${description}`);
console.log(`🔗 Dotfiles URL: ${dotfilesUrl}`);
console.log(`📱 Reddit URL: ${redditUrl || "N/A"}`);
