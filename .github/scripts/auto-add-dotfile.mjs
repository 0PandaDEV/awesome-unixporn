import { readFile } from 'fs/promises'
import { Octokit } from 'octokit'

const [issueRaw, repo, issueNumber] = process.argv
const issue = JSON.parse(issueRaw)
const token = process.env.GITHUB_TOKEN
const octokit = new Octokit({ auth: token })

const getField = (id) => {
  const f = issue.body.match(new RegExp(`\n\s*### ${id.replace(/[-]/g, '[-]')}\n([\s\S]*?)(?=\n### |$)`, 'i'))
  return f ? f[1].trim() : ''
}

const getCheckbox = (id, label) => {
  const re = new RegExp(`- [([ xX])] ${label}`)
  const f = issue.body.match(re)
  return f && f[1] !== ' ' ? true : false
}

const autoConvertChecked = getCheckbox('auto-convert', 'I want to automatically add it')
if (!autoConvertChecked) process.exit(0)

const dotfilesUrl = getField('Dotfiles URL')
const appCategory = getField('DE or WM')
const description = getField('Description')
const redditUrl = getField('Reddit URL')
const image = getField('Preview Image')

const username = dotfilesUrl.replace(/https:\/\/github.com\//, '').split('/')[0]
const imgMatch = image.match(/!\[.*?\]\((.*?)\)/)
const imgUrl = imgMatch ? imgMatch[1] : ''

const section = appCategory.replace(/ /g, '')
const readmePath = 'README.md'
const readme = await readFile(readmePath, 'utf8')
const sectionHeader = `# ${section}`
const sectionIndex = readme.indexOf(sectionHeader)
if (sectionIndex === -1) process.exit(1)
const nextSection = readme.indexOf('# ', sectionIndex + 1)
const before = readme.slice(0, nextSection === -1 ? undefined : nextSection)
const after = nextSection === -1 ? '' : readme.slice(nextSection)

const table = `\n<table>\n  <tr>\n    <td>\n      <a href=\"${dotfilesUrl}\">${username}</a> - ${description}\n    </td>\n  </tr>\n  <tr>\n    <td>\n      <a href=\"${redditUrl || '#'}\">\n        <img src=\"${imgUrl}\" alt=\"reddit post\"/>\n      </a>\n    </td>\n  </tr>\n</table>\n`

const newReadme = before + table + after
const branch = `auto/add-dotfile-${issueNumber}`

const { data: branchData } = await octokit.rest.repos.getBranch({
  owner: repo.split('/')[0],
  repo: repo.split('/')[1],
  branch: (await octokit.rest.repos.get({ owner: repo.split('/')[0], repo: repo.split('/')[1] })).data.default_branch
})

await octokit.rest.git.createRef({
  owner: repo.split('/')[0],
  repo: repo.split('/')[1],
  ref: `refs/heads/${branch}`,
  sha: branchData.commit.sha
})

const { data: { sha } } = await octokit.rest.repos.getContent({
  owner: repo.split('/')[0],
  repo: repo.split('/')[1],
  path: readmePath,
  ref: branch
})

await octokit.rest.repos.createOrUpdateFileContents({
  owner: repo.split('/')[0],
  repo: repo.split('/')[1],
  path: readmePath,
  message: `feat(readme): add ${username} dotfiles for ${section}`,
  content: Buffer.from(newReadme).toString('base64'),
  branch,
  sha
})

await octokit.rest.pulls.create({
  owner: repo.split('/')[0],
  repo: repo.split('/')[1],
  title: `add: ${username} dotfiles for ${section}`,
  head: branch,
  base: (await octokit.rest.repos.get({ owner: repo.split('/')[0], repo: repo.split('/')[1] })).data.default_branch,
  body: `auto add from issue #${issueNumber}`
}) 