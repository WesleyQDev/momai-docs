# MomAI Docs

Studio for creating documents, presentations, podcasts, and explainer videos **fully grounded in project sources**, with a library of professional templates and letterhead filling.

## When to use these tools

Use `momai-docs` when the user asks to:
- Create or manage a source project/notebook (`docs_project_manage`)
- Add files, web links, YouTube videos, text, or discover sources on a topic (`docs_source_add`, `docs_source_discover`)
- Query or synthesize information using only project sources (`docs_source_query`)
- List available tools or templates (`docs_templates_list`)
- Generate an official letter/formal letter, study guide, ABNT paper, completed letterhead, PowerPoint presentation (PPTX), audio podcast, MP4 explainer video, executive report, flashcards/quiz, mind map/timeline, or XLSX spreadsheet (`docs_artifact_generate`)
- Refine, adjust, or revert a version of generated material (`docs_artifact_refine`)
- Export a finished artifact (`docs_artifact_export`)

## Golden rules

1. **Strict source fidelity:** never invent facts, numbers, quotations, or references outside the active sources unless the user explicitly selects `sources_plus_general`. If the sources lack required information, state that clearly and offer `docs_source_discover`.
2. **Confirm ambiguity:** if it is unclear which tool or template to use, or if more than one project exists, confirm briefly with the user or list the options from `docs_templates_list`.
3. **Letterhead:** when the user provides a branded `.docx` or `.pdf` file to fill, pass its base64 content in `letterheadFileBase64` and its name in `letterheadFileName` to `docs_artifact_generate` with `toolId: "letterhead"`. Never recreate the letterhead from scratch.
4. **Clear delivery:** after starting or completing generation, present the summary, the citations used, and the export link/button.
