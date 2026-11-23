# MomAI Docs

Studio de criação de documentos, apresentações, podcasts e vídeos explicativos **100% fundamentados nas fontes do projeto**, com biblioteca de templates profissionais e preenchimento de folha timbrada.

## Quando usar estas ferramentas

Use `momai-docs` quando o usuário pedir para:
- Criar ou gerenciar um projeto/caderno de fontes (`docs_project_manage`)
- Adicionar arquivos, links web, vídeos do YouTube, texto ou buscar fontes sobre um tema (`docs_source_add`, `docs_source_discover`)
- Consultar ou sintetizar informações exclusivamente com base nas fontes do projeto (`docs_source_query`)
- Listar ferramentas ou templates disponíveis (`docs_templates_list`)
- Gerar Ofício/Carta Formal, Apostila, Trabalho ABNT, Folha Timbrada preenchida, Apresentação PowerPoint (PPTX), Podcast em áudio, Vídeo explicativo MP4, Relatório Executivo, Flashcards/Quiz, Mapa Mental/Linha do Tempo ou Planilha XLSX (`docs_artifact_generate`)
- Refinar, ajustar ou reverter versão de um material gerado (`docs_artifact_refine`)
- Exportar um artefato pronto (`docs_artifact_export`)

## Regras de ouro

1. **Fidelidade estrita às fontes:** nunca invente fatos, números, citações ou referências fora das fontes ativas (a menos que o usuário selecione explicitamente o modo `sources_plus_general`). Se faltar informação nas fontes, informe claramente e ofereça `docs_source_discover`.
2. **Confirmar ambiguidade:** se houver dúvida sobre qual ferramenta ou template usar (ou se há mais de um projeto), confirme brevemente com o usuário ou liste as opções de `docs_templates_list`.
3. **Folha timbrada:** quando o usuário enviar um arquivo `.docx` ou `.pdf` timbrado para preencher, passe o caminho/id em `letterheadSource` no `docs_artifact_generate` com `toolId: "letterhead"` — nunca recrie o timbrado do zero.
4. **Entrega clara:** após iniciar ou concluir a geração, apresente o resumo, as citações usadas e o link/botão de exportação.
