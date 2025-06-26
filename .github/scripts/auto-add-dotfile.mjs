import { readFile, writeFile } from "fs/promises";

// Read JSON from stdin
let issueRaw = "";
for await (const chunk of process.stdin) {
  issueRaw += chunk;
}

const issue = JSON.parse(issueRaw);
const issueNumber = issue.number;

const getField = (id) => {
  const f = issue.body.match(
    new RegExp(
      `\n\s*### ${id.replace(/[-]/g, "[-]")}\n([\s\S]*?)(?=\n### |$)`,
      "i",
    ),
  );
  return f ? f[1].trim() : "";
};

const getCheckbox = (id, label) => {
  const re = new RegExp(`- \\[([ xX])\\] ${label}`);
  const f = issue.body.match(re);
  return f && f[1] !== " " ? true : false;
};

const autoConvertChecked = getCheckbox(
  "auto-convert",
  "I want to automatically add it",
);
if (!autoConvertChecked) process.exit(0);

const dotfilesUrl = getField("Dotfiles URL");
const appCategory = getField("DE or WM");
const description = getField("Description");
const redditUrl = getField("Reddit URL");
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
const before = readme.slice(0, nextSection === -1 ? undefined : nextSection);
const after = nextSection === -1 ? "" : readme.slice(nextSection);

const table = `\n<table>\n  <tr>\n    <td>\n      <a href=\"${dotfilesUrl}\">${username}</a> - ${description}\n    </td>\n  </tr>\n  <tr>\n    <td>\n      <a href=\"${
  redditUrl || "#"
}\">\n        <img src=\"${imgUrl}\" alt=\"reddit post\"/>\n      </a>\n    </td>\n  </tr>\n</table>\n`;

const newReadme = before + table + after;

// Write the updated README to the file system
await writeFile(readmePath, newReadme, "utf8");

console.log(
  `✅ Updated ${readmePath} with ${username}'s dotfiles for ${section}`,
);
console.log(`📝 Description: ${description}`);
console.log(`🔗 Dotfiles URL: ${dotfilesUrl}`);
console.log(`📱 Reddit URL: ${redditUrl || "N/A"}`);
