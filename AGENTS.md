# AGENTS.md

## Purpose

This workspace is used to create a personal portfolio website through guided AI-assisted development.

Follow the user’s current instruction exactly. Do not expand the task beyond what the user explicitly asks for.

## Stage-Gate Rule: Do Not Build Early

The user may complete setup in several separate steps, such as creating this file, installing design skills, adding reference links, or preparing materials.

During setup, you must not:

- create an implementation plan;
- create, edit, replace, or delete website files;
- generate a starter template;
- run a local server, preview the website, open a browser, or perform tests;
- inspect or use attached portfolio materials;
- make assumptions about the website’s design, content, technology, or sections.

Only begin planning, designing, coding, running, previewing, or testing the portfolio when the user sends an explicit instruction to build or implement the website, such as their final ultimate prompt.


If the task is limited to AGENTS.md, a skill, plugin, configuration, or reference research, complete only that task and then stop.

## Scope Control

- Make only the changes required for the current instruction.
- Do not modify files outside the currently opened project folder.
- Do not search the user’s Desktop, Documents, Downloads, drives, or other folders unless the user explicitly asks you to access a specific location.
- Do not create extra files, dependencies, frameworks, accounts, repositories, commits, deployments, or external services unless explicitly requested.
- Do not use a planning workflow when the user requests a simple file creation or configuration task.

## Working With Personal Materials

When the user explicitly asks you to use attached résumé, CV, certificates, project files, LinkedIn information, or portfolio materials:

- Read all relevant attached materials before writing content.
- Treat them as the factual source of truth.
- Never invent experience, qualifications, awards, skills, metrics, project outcomes, employment history, links, testimonials, client names, or contact details.
- Omit unclear information rather than guessing.
- Do not expose sensitive information such as identification numbers, full home address, private phone number, passwords, API keys, or confidential data.

## When Building Is Explicitly Requested

Once the user explicitly asks to build the portfolio:

- Read the user’s task prompt and relevant attachments first.
- Briefly state the intended design direction, then implement the work.
- Use installed skills when applicable.
- Build a polished, responsive, accessible website using factual content only.
- Keep changes focused and avoid unnecessary complexity or dependencies.
- Test the final website locally only if the user’s task explicitly includes implementation or verification.
- Fix clear errors before reporting completion.

## Quality Standards

- Maintain clean, readable, and well-structured code.
- Make layouts responsive for mobile, tablet, and desktop.
- Use semantic HTML and accessible labels, keyboard navigation, visible focus states, sufficient colour contrast, and reduced-motion support where animation is used.
- Avoid broken links, console errors, fake functionality, placeholder content, and unfinished sections.
- Prefer lightweight, maintainable solutions over heavy libraries or complex effects.

## Confirm Before High-Impact Actions

Ask for explicit confirmation before:

- deleting or overwriting important existing work;
- installing large or unnecessary dependencies;
- pushing to GitHub or another remote repository;
- deploying or publishing a website;
- using paid services, external APIs, or credentials;
- sending messages, forms, emails, or data to third parties;
- accessing files outside the opened project folder.

## Communication

- Work independently within the approved scope.
- Do not ask unnecessary preference questions during an explicitly approved build task; make sensible, reversible decisions.
- If essential information is missing, state what was omitted and continue with the available factual material.
- At the end of a completed build task, follow the response format specified in the user’s current task. If no format is specified, report what was built, files changed, verification performed, and information needing confirmation.
