import type { DocsLocale } from '../core/i18n'

/**
 * UI translation catalog.
 *
 * Keys are the Portuguese source strings used by the extension UI. Keeping the
 * source text as the key avoids a second naming layer and guarantees that an
 * untranslated string still renders in Portuguese instead of showing a raw key.
 *
 * `pt-BR` is the identity locale and therefore has no entries of its own.
 */
export type DocsCatalog = Record<string, Partial<Record<Exclude<DocsLocale, 'pt-BR'>, string>>>

export const CATALOG: DocsCatalog = {
  // Shell, navigation and projects
  'MomAI Docs': {
    'en-US': 'MomAI Docs',
    es: 'MomAI Docs',
    fr: 'MomAI Docs',
    de: 'MomAI Docs',
    it: 'MomAI Docs'
  },
  'Estúdio editorial fundamentado nas suas fontes': {
    'en-US': 'Editorial studio grounded in your sources',
    es: 'Estudio editorial basado en tus fuentes',
    fr: 'Studio éditorial fondé sur vos sources',
    de: 'Redaktionsstudio auf Basis Ihrer Quellen',
    it: 'Studio editoriale basato sulle tue fonti'
  },
  'Novo projeto': {
    'en-US': 'New project',
    es: 'Nuevo proyecto',
    fr: 'Nouveau projet',
    de: 'Neues Projekt',
    it: 'Nuovo progetto'
  },
  'Novo Projeto': {
    'en-US': 'New Project',
    es: 'Nuevo Proyecto',
    fr: 'Nouveau Projet',
    de: 'Neues Projekt',
    it: 'Nuovo Progetto'
  },
  'Projeto sem título': {
    'en-US': 'Untitled project',
    es: 'Proyecto sin título',
    fr: 'Projet sans titre',
    de: 'Unbenanntes Projekt',
    it: 'Progetto senza titolo'
  },
  'Início': {
    'en-US': 'Home',
    es: 'Inicio',
    fr: 'Accueil',
    de: 'Start',
    it: 'Home'
  },
  'Estúdio': {
    'en-US': 'Studio',
    es: 'Estudio',
    fr: 'Studio',
    de: 'Studio',
    it: 'Studio'
  },
  'Projetos': {
    'en-US': 'Projects',
    es: 'Proyectos',
    fr: 'Projets',
    de: 'Projekte',
    it: 'Progetti'
  },
  'Seus projetos': {
    'en-US': 'Your projects',
    es: 'Tus proyectos',
    fr: 'Vos projets',
    de: 'Ihre Projekte',
    it: 'I tuoi progetti'
  },
  'Nenhum projeto ainda': {
    'en-US': 'No projects yet',
    es: 'Todavía no hay proyectos',
    fr: 'Aucun projet pour le moment',
    de: 'Noch keine Projekte',
    it: 'Nessun progetto'
  },
  'Nenhum projeto recente': {
    'en-US': 'No recent projects',
    es: 'Sin proyectos recientes',
    fr: 'Aucun projet récent',
    de: 'Keine aktuellen Projekte',
    it: 'Nessun progetto recente'
  },
  'Voltar': {
    'en-US': 'Back',
    es: 'Volver',
    fr: 'Retour',
    de: 'Zurück',
    it: 'Indietro'
  },
  'Próxima': {
    'en-US': 'Next',
    es: 'Siguiente',
    fr: 'Suivant',
    de: 'Weiter',
    it: 'Avanti'
  },
  'Próximo': {
    'en-US': 'Next',
    es: 'Siguiente',
    fr: 'Suivant',
    de: 'Weiter',
    it: 'Avanti'
  },
  'Continuar': {
    'en-US': 'Continue',
    es: 'Continuar',
    fr: 'Continuer',
    de: 'Weiter',
    it: 'Continua'
  },
  'Cancelar': {
    'en-US': 'Cancel',
    es: 'Cancelar',
    fr: 'Annuler',
    de: 'Abbrechen',
    it: 'Annulla'
  },
  'Adicionar': {
    'en-US': 'Add',
    es: 'Añadir',
    fr: 'Ajouter',
    de: 'Hinzufügen',
    it: 'Aggiungi'
  },
  'Remover': {
    'en-US': 'Remove',
    es: 'Quitar',
    fr: 'Retirer',
    de: 'Entfernen',
    it: 'Rimuovi'
  },
  'Salvar': {
    'en-US': 'Save',
    es: 'Guardar',
    fr: 'Enregistrer',
    de: 'Speichern',
    it: 'Salva'
  },
  'Criar': {
    'en-US': 'Create',
    es: 'Crear',
    fr: 'Créer',
    de: 'Erstellen',
    it: 'Crea'
  },
  'Criar projeto': {
    'en-US': 'Create project',
    es: 'Crear proyecto',
    fr: 'Créer le projet',
    de: 'Projekt erstellen',
    it: 'Crea progetto'
  },
  'Criar novo projeto': {
    'en-US': 'Create new project',
    es: 'Crear nuevo proyecto',
    fr: 'Créer un nouveau projet',
    de: 'Neues Projekt erstellen',
    it: 'Crea nuovo progetto'
  },
  'Clique para renomear o projeto': {
    'en-US': 'Click to rename the project',
    es: 'Haz clic para renombrar el proyecto',
    fr: 'Cliquez pour renommer le projet',
    de: 'Klicken Sie, um das Projekt umzubenennen',
    it: 'Fai clic per rinominare il progetto'
  },
  'Configurar timbre e identidade visual': {
    'en-US': 'Configure letterhead and visual identity',
    es: 'Configurar membrete e identidad visual',
    fr: 'Configurer l’en-tête et l’identité visuelle',
    de: 'Briefkopf und visuelle Identität einrichten',
    it: 'Configura carta intestata e identità visiva'
  },
  'Fechar aviso': {
    'en-US': 'Dismiss notice',
    es: 'Cerrar aviso',
    fr: 'Fermer l’avertissement',
    de: 'Hinweis schließen',
    it: 'Chiudi avviso'
  },
  'Fechar': {
    'en-US': 'Close',
    es: 'Cerrar',
    fr: 'Fermer',
    de: 'Schließen',
    it: 'Chiudi'
  },
  'Abrir': {
    'en-US': 'Open',
    es: 'Abrir',
    fr: 'Ouvrir',
    de: 'Öffnen',
    it: 'Apri'
  },
  'Excluir': {
    'en-US': 'Delete',
    es: 'Eliminar',
    fr: 'Supprimer',
    de: 'Löschen',
    it: 'Elimina'
  },
  'Renomear': {
    'en-US': 'Rename',
    es: 'Renombrar',
    fr: 'Renommer',
    de: 'Umbenennen',
    it: 'Rinomina'
  },
  'Fixar no topo': {
    'en-US': 'Pin to top',
    es: 'Fijar arriba',
    fr: 'Épingler en haut',
    de: 'Oben anheften',
    it: 'Fissa in alto'
  },
  'Desafixar': {
    'en-US': 'Unpin',
    es: 'Desfijar',
    fr: 'Désépingler',
    de: 'Loslösen',
    it: 'Rimuovi fissaggio'
  },
  'Fila de tarefas': {
    'en-US': 'Task queue',
    es: 'Cola de tareas',
    fr: 'File de tâches',
    de: 'Aufgabenwarteschlange',
    it: 'Coda attività'
  },
  'Kit de marca': {
    'en-US': 'Brand kit',
    es: 'Kit de marca',
    fr: 'Kit de marque',
    de: 'Marken-Kit',
    it: 'Kit di brand'
  },
  'Diagnóstico': {
    'en-US': 'Diagnostics',
    es: 'Diagnóstico',
    fr: 'Diagnostic',
    de: 'Diagnose',
    it: 'Diagnostica'
  },
  'Créditos & Licenças': {
    'en-US': 'Credits & licenses',
    es: 'Créditos y licencias',
    fr: 'Crédits et licences',
    de: 'Credits und Lizenzen',
    it: 'Crediti e licenze'
  },
  'Licenças e créditos': {
    'en-US': 'Licenses and credits',
    es: 'Licencias y créditos',
    fr: 'Licences et crédits',
    de: 'Lizenzen und Credits',
    it: 'Licenze e crediti'
  },
  'Diagnóstico do ambiente': {
    'en-US': 'Environment diagnostics',
    es: 'Diagnóstico del entorno',
    fr: 'Diagnostic de l’environnement',
    de: 'Umgebungsdiagnose',
    it: 'Diagnostica dell’ambiente'
  },
  'Copiar diagnóstico': {
    'en-US': 'Copy diagnostics',
    es: 'Copiar diagnóstico',
    fr: 'Copier le diagnostic',
    de: 'Diagnose kopieren',
    it: 'Copia diagnostica'
  },
  'Nenhuma tarefa em segundo plano registrada.': {
    'en-US': 'No background tasks recorded.',
    es: 'No hay tareas en segundo plano registradas.',
    fr: 'Aucune tâche en arrière-plan enregistrée.',
    de: 'Keine Hintergrundaufgaben aufgezeichnet.',
    it: 'Nessuna attività in background registrata.'
  },

  // Workspace, sources and chat
  'Fontes': {
    'en-US': 'Sources',
    es: 'Fuentes',
    fr: 'Sources',
    de: 'Quellen',
    it: 'Fonti'
  },
  'Fontes da verdade': {
    'en-US': 'Sources of truth',
    es: 'Fuentes de verdad',
    fr: 'Sources de vérité',
    de: 'Wahrheitsquellen',
    it: 'Fonti di verità'
  },
  'Ferramentas & Templates': {
    'en-US': 'Tools & templates',
    es: 'Herramientas y plantillas',
    fr: 'Outils et modèles',
    de: 'Werkzeuge und Vorlagen',
    it: 'Strumenti e modelli'
  },
  'Chat do Projeto': {
    'en-US': 'Project chat',
    es: 'Chat del proyecto',
    fr: 'Chat du projet',
    de: 'Projekt-Chat',
    it: 'Chat del progetto'
  },
  'Artefatos & Refino': {
    'en-US': 'Artifacts & refine',
    es: 'Artefactos y refinamiento',
    fr: 'Artefacts et affinage',
    de: 'Artefakte und Verfeinerung',
    it: 'Artefatti e rifinitura'
  },
  'Buscar fontes na web': {
    'en-US': 'Search sources on the web',
    es: 'Buscar fuentes en la web',
    fr: 'Rechercher des sources sur le web',
    de: 'Quellen im Web suchen',
    it: 'Cerca fonti sul web'
  },
  'Descobrir fontes': {
    'en-US': 'Discover sources',
    es: 'Descubrir fuentes',
    fr: 'Découvrir des sources',
    de: 'Quellen entdecken',
    it: 'Scopri fonti'
  },
  'Descobrir fontes confiáveis': {
    'en-US': 'Discover reliable sources',
    es: 'Descubrir fuentes fiables',
    fr: 'Découvrir des sources fiables',
    de: 'Verlässliche Quellen entdecken',
    it: 'Scopri fonti affidabili'
  },
  'Importar fonte': {
    'en-US': 'Import source',
    es: 'Importar fuente',
    fr: 'Importer une source',
    de: 'Quelle importieren',
    it: 'Importa fonte'
  },
  'Adicionar fonte': {
    'en-US': 'Add source',
    es: 'Añadir fuente',
    fr: 'Ajouter une source',
    de: 'Quelle hinzufügen',
    it: 'Aggiungi fonte'
  },
  'Adicionar arquivos': {
    'en-US': 'Add files',
    es: 'Añadir archivos',
    fr: 'Ajouter des fichiers',
    de: 'Dateien hinzufügen',
    it: 'Aggiungi file'
  },
  'Arquivo': {
    'en-US': 'File',
    es: 'Archivo',
    fr: 'Fichier',
    de: 'Datei',
    it: 'File'
  },
  'Link / YouTube': {
    'en-US': 'Link / YouTube',
    es: 'Enlace / YouTube',
    fr: 'Lien / YouTube',
    de: 'Link / YouTube',
    it: 'Link / YouTube'
  },
  'Colar texto': {
    'en-US': 'Paste text',
    es: 'Pegar texto',
    fr: 'Coller le texte',
    de: 'Text einfügen',
    it: 'Incolla testo'
  },
  'Colar texto como fonte': {
    'en-US': 'Paste text as a source',
    es: 'Pegar texto como fuente',
    fr: 'Coller le texte comme source',
    de: 'Text als Quelle einfügen',
    it: 'Incolla testo come fonte'
  },
  'Adicionar URL / YouTube': {
    'en-US': 'Add URL / YouTube',
    es: 'Añadir URL / YouTube',
    fr: 'Ajouter une URL / YouTube',
    de: 'URL / YouTube hinzufügen',
    it: 'Aggiungi URL / YouTube'
  },
  'Adicionar URL ou YouTube': {
    'en-US': 'Add URL or YouTube',
    es: 'Añadir URL o YouTube',
    fr: 'Ajouter une URL ou YouTube',
    de: 'URL oder YouTube hinzufügen',
    it: 'Aggiungi URL o YouTube'
  },
  'Adicionar URL ou vídeo do YouTube': {
    'en-US': 'Add a URL or YouTube video',
    es: 'Añadir una URL o vídeo de YouTube',
    fr: 'Ajouter une URL ou une vidéo YouTube',
    de: 'URL oder YouTube-Video hinzufügen',
    it: 'Aggiungi URL o video YouTube'
  },
  'Adicionar texto': {
    'en-US': 'Add text',
    es: 'Añadir texto',
    fr: 'Ajouter du texte',
    de: 'Text hinzufügen',
    it: 'Aggiungi testo'
  },
  '+ Adicionar': {
    'en-US': '+ Add',
    es: '+ Añadir',
    fr: '+ Ajouter',
    de: '+ Hinzufügen',
    it: '+ Aggiungi'
  },
  'Remover fonte': {
    'en-US': 'Remove source',
    es: 'Quitar fuente',
    fr: 'Retirer la source',
    de: 'Quelle entfernen',
    it: 'Rimuovi fonte'
  },
  'Sugestões encontradas': {
    'en-US': 'Suggestions found',
    es: 'Sugerencias encontradas',
    fr: 'Suggestions trouvées',
    de: 'Gefundene Vorschläge',
    it: 'Suggerimenti trovati'
  },
  'Nenhuma fonte adicionada ainda.': {
    'en-US': 'No sources added yet.',
    es: 'Todavía no hay fuentes añadidas.',
    fr: 'Aucune source ajoutée pour le moment.',
    de: 'Noch keine Quellen hinzugefügt.',
    it: 'Nessuna fonte aggiunta.'
  },
  'Converse com as suas fontes': {
    'en-US': 'Chat with your sources',
    es: 'Conversa con tus fuentes',
    fr: 'Échangez avec vos sources',
    de: 'Sprechen Sie mit Ihren Quellen',
    it: 'Conversa con le tue fonti'
  },
  'Faça perguntas com citações rastreáveis ou escolha um formato no painel Estúdio ao lado para gerar seu documento.': {
    'en-US': 'Ask questions with traceable citations or pick a format in the Studio panel to generate your document.',
    es: 'Haz preguntas con citas rastreables o elige un formato en el panel Estudio para generar tu documento.',
    fr: 'Posez des questions avec des citations traçables ou choisissez un format dans le panneau Studio pour générer votre document.',
    de: 'Stellen Sie Fragen mit nachvollziehbaren Zitaten oder wählen Sie ein Format im Studio-Panel, um Ihr Dokument zu erstellen.',
    it: 'Fai domande con citazioni tracciabili o scegli un formato nel pannello Studio per generare il documento.'
  },
  'Pergunte às fontes do projeto...': {
    'en-US': 'Ask your project sources...',
    es: 'Pregunta a las fuentes del proyecto...',
    fr: 'Interrogez les sources du projet...',
    de: 'Fragen Sie die Projektquellen...',
    it: 'Chiedi alle fonti del progetto...'
  },
  'As respostas usam apenas as fontes indexadas neste projeto.': {
    'en-US': 'Answers use only the sources indexed in this project.',
    es: 'Las respuestas usan solo las fuentes indexadas en este proyecto.',
    fr: 'Les réponses utilisent uniquement les sources indexées dans ce projet.',
    de: 'Antworten verwenden nur die in diesem Projekt indexierten Quellen.',
    it: 'Le risposte usano solo le fonti indicizzate in questo progetto.'
  },
  'Novo chat': {
    'en-US': 'New chat',
    es: 'Nuevo chat',
    fr: 'Nouveau chat',
    de: 'Neuer Chat',
    it: 'Nuova chat'
  },
  'Limpar conversa e iniciar novo chat': {
    'en-US': 'Clear the conversation and start a new chat',
    es: 'Borrar la conversación e iniciar un chat nuevo',
    fr: 'Effacer la conversation et démarrer un nouveau chat',
    de: 'Unterhaltung löschen und neuen Chat starten',
    it: 'Cancella la conversazione e avvia una nuova chat'
  },
  'Continuar resposta': {
    'en-US': 'Continue answer',
    es: 'Continuar respuesta',
    fr: 'Continuer la réponse',
    de: 'Antwort fortsetzen',
    it: 'Continua risposta'
  },
  'Parar geração': {
    'en-US': 'Stop generation',
    es: 'Detener generación',
    fr: 'Arrêter la génération',
    de: 'Generierung stoppen',
    it: 'Interrompi generazione'
  },
  'Mais opções': {
    'en-US': 'More options',
    es: 'Más opciones',
    fr: 'Plus d’options',
    de: 'Weitere Optionen',
    it: 'Altre opzioni'
  },
  'Mostrar menos opções': {
    'en-US': 'Show fewer options',
    es: 'Mostrar menos opciones',
    fr: 'Afficher moins d’options',
    de: 'Weniger Optionen anzeigen',
    it: 'Mostra meno opzioni'
  },
  'Ver todos': {
    'en-US': 'See all',
    es: 'Ver todos',
    fr: 'Tout voir',
    de: 'Alle anzeigen',
    it: 'Vedi tutti'
  },
  'Menos': {
    'en-US': 'Less',
    es: 'Menos',
    fr: 'Moins',
    de: 'Weniger',
    it: 'Meno'
  },
  'Na fila...': {
    'en-US': 'Queued...',
    es: 'En cola...',
    fr: 'En file...',
    de: 'In der Warteschlange...',
    it: 'In coda...'
  },
  'Continuar geração': {
    'en-US': 'Resume generation',
    es: 'Continuar generación',
    fr: 'Reprendre la génération',
    de: 'Generierung fortsetzen',
    it: 'Riprendi generazione'
  },
  'Remover da lista': {
    'en-US': 'Remove from list',
    es: 'Quitar de la lista',
    fr: 'Retirer de la liste',
    de: 'Aus der Liste entfernen',
    it: 'Rimuovi dalla lista'
  },
  'Reproduzir vídeo': {
    'en-US': 'Play video',
    es: 'Reproducir vídeo',
    fr: 'Lire la vidéo',
    de: 'Video abspielen',
    it: 'Riproduci video'
  },
  'Gerando prévia...': {
    'en-US': 'Generating preview...',
    es: 'Generando vista previa...',
    fr: 'Génération de l’aperçu...',
    de: 'Vorschau wird erstellt...',
    it: 'Generazione anteprima...'
  },
  'Carregando prévia do vídeo...': {
    'en-US': 'Loading video preview...',
    es: 'Cargando vista previa del vídeo...',
    fr: 'Chargement de l’aperçu vidéo...',
    de: 'Videovorschau wird geladen...',
    it: 'Caricamento anteprima video...'
  },
  'Não foi possível carregar a prévia do vídeo.': {
    'en-US': 'Could not load the video preview.',
    es: 'No se pudo cargar la vista previa del vídeo.',
    fr: 'Impossible de charger l’aperçu vidéo.',
    de: 'Die Videovorschau konnte nicht geladen werden.',
    it: 'Impossibile caricare l’anteprima video.'
  },
  'concluído': {
    'en-US': 'completed',
    es: 'completado',
    fr: 'terminé',
    de: 'abgeschlossen',
    it: 'completato'
  },
  'Prévia': {
    'en-US': 'Preview',
    es: 'Vista previa',
    fr: 'Aperçu',
    de: 'Vorschau',
    it: 'Anteprima'
  },
  'Opções de exportação': {
    'en-US': 'Export options',
    es: 'Opciones de exportación',
    fr: 'Options d’exportation',
    de: 'Exportoptionen',
    it: 'Opzioni di esportazione'
  },
  'Incluir capa e sumário': {
    'en-US': 'Include cover and table of contents',
    es: 'Incluir portada y índice',
    fr: 'Inclure la couverture et la table des matières',
    de: 'Titelblatt und Inhaltsverzeichnis einfügen',
    it: 'Includi copertina e indice'
  },
  'Aplicar timbre da instituição': {
    'en-US': 'Apply institution letterhead',
    es: 'Aplicar membrete de la institución',
    fr: 'Appliquer l’en-tête de l’institution',
    de: 'Briefkopf der Institution anwenden',
    it: 'Applica carta intestata dell’istituzione'
  },
  'Versão atual': {
    'en-US': 'Current version',
    es: 'Versión actual',
    fr: 'Version actuelle',
    de: 'Aktuelle Version',
    it: 'Versione attuale'
  },
  'Citações rastreáveis': {
    'en-US': 'Traceable citations',
    es: 'Citas rastreables',
    fr: 'Citations traçables',
    de: 'Nachvollziehbare Zitate',
    it: 'Citazioni tracciabili'
  },
  '2. Configurar': {
    'en-US': '2. Configure',
    es: '2. Configurar',
    fr: '2. Configurer',
    de: '2. Konfigurieren',
    it: '2. Configura'
  },
  '1. Fontes': {
    'en-US': '1. Sources',
    es: '1. Fuentes',
    fr: '1. Sources',
    de: '1. Quellen',
    it: '1. Fonti'
  },
  'Adicione arquivos, links ou textos para fundamentar seu material, ou pule esta etapa para criar direto a partir das suas instruções.': {
    'en-US': 'Add files, links or text to ground your material, or skip this step to create directly from your instructions.',
    es: 'Añade archivos, enlaces o textos para fundamentar tu material, o salta este paso para crear directamente desde tus instrucciones.',
    fr: 'Ajoutez des fichiers, des liens ou du texte pour fonder votre contenu, ou passez cette étape pour créer directement à partir de vos instructions.',
    de: 'Fügen Sie Dateien, Links oder Text hinzu, um Ihr Material zu belegen, oder überspringen Sie diesen Schritt und erstellen Sie direkt aus Ihren Anweisungen.',
    it: 'Aggiungi file, link o testo per fondare il materiale, oppure salta questo passaggio per creare direttamente dalle tue istruzioni.'
  },
  'Pular fontes e configurar': {
    'en-US': 'Skip sources and configure',
    es: 'Saltar fuentes y configurar',
    fr: 'Ignorer les sources et configurer',
    de: 'Quellen überspringen und konfigurieren',
    it: 'Salta le fonti e configura'
  },
  'Instruções (opcional)': {
    'en-US': 'Instructions (optional)',
    es: 'Instrucciones (opcional)',
    fr: 'Instructions (facultatif)',
    de: 'Anweisungen (optional)',
    it: 'Istruzioni (opzionale)'
  },
  'Modelo de IA': {
    'en-US': 'AI model',
    es: 'Modelo de IA',
    fr: 'Modèle d’IA',
    de: 'KI-Modell',
    it: 'Modello AI'
  },
  'Automático (Padrão)': {
    'en-US': 'Automatic (default)',
    es: 'Automático (predeterminado)',
    fr: 'Automatique (par défaut)',
    de: 'Automatisch (Standard)',
    it: 'Automatico (predefinito)'
  },
  'Automática (Padrão)': {
    'en-US': 'Automatic (default)',
    es: 'Automática (predeterminada)',
    fr: 'Automatique (par défaut)',
    de: 'Automatisch (Standard)',
    it: 'Automatica (predefinita)'
  },
  'Automático (manter)': {
    'en-US': 'Automatic (keep)',
    es: 'Automático (mantener)',
    fr: 'Automatique (conserver)',
    de: 'Automatisch (beibehalten)',
    it: 'Automatico (mantieni)'
  },
  'Automático': {
    'en-US': 'Automatic',
    es: 'Automático',
    fr: 'Automatique',
    de: 'Automatisch',
    it: 'Automatico'
  },
  '2 (Diálogo)': {
    'en-US': '2 (dialogue)',
    es: '2 (diálogo)',
    fr: '2 (dialogue)',
    de: '2 (Dialog)',
    it: '2 (dialogo)'
  },
  'Voz da narração': {
    'en-US': 'Narration voice',
    es: 'Voz de la narración',
    fr: 'Voix de la narration',
    de: 'Erzählerstimme',
    it: 'Voce della narrazione'
  },
  'Opções de legendas': {
    'en-US': 'Subtitle options',
    es: 'Opciones de subtítulos',
    fr: 'Options de sous-titres',
    de: 'Untertiteloptionen',
    it: 'Opzioni sottotitoli'
  },
  'Cabeçalho': {
    'en-US': 'Header',
    es: 'Encabezado',
    fr: 'En-tête',
    de: 'Kopfzeile',
    it: 'Intestazione'
  },
  'Rodapé': {
    'en-US': 'Footer',
    es: 'Pie de página',
    fr: 'Pied de page',
    de: 'Fußzeile',
    it: 'Piè di pagina'
  },
  'Texto do cabeçalho (opcional)': {
    'en-US': 'Header text (optional)',
    es: 'Texto del encabezado (opcional)',
    fr: 'Texte de l’en-tête (facultatif)',
    de: 'Kopfzeilentext (optional)',
    it: 'Testo dell’intestazione (opzionale)'
  },
  'Texto do rodapé (opcional)': {
    'en-US': 'Footer text (optional)',
    es: 'Texto del pie de página (opcional)',
    fr: 'Texte du pied de page (facultatif)',
    de: 'Fußzeilentext (optional)',
    it: 'Testo del piè di pagina (opzionale)'
  },
  'Gerar agora': {
    'en-US': 'Generate now',
    es: 'Generar ahora',
    fr: 'Générer maintenant',
    de: 'Jetzt generieren',
    it: 'Genera ora'
  },
  'Gerar material': {
    'en-US': 'Generate material',
    es: 'Generar material',
    fr: 'Générer le contenu',
    de: 'Material generieren',
    it: 'Genera materiale'
  },
  'Gerando...': {
    'en-US': 'Generating...',
    es: 'Generando...',
    fr: 'Génération...',
    de: 'Wird generiert...',
    it: 'Generazione...'
  },
  'Exportar': {
    'en-US': 'Export',
    es: 'Exportar',
    fr: 'Exporter',
    de: 'Exportieren',
    it: 'Esporta'
  },
  'Refinar': {
    'en-US': 'Refine',
    es: 'Refinar',
    fr: 'Affiner',
    de: 'Verfeinern',
    it: 'Rifinisci'
  },
  'Aplicar revisão': {
    'en-US': 'Apply revision',
    es: 'Aplicar revisión',
    fr: 'Appliquer la révision',
    de: 'Überarbeitung anwenden',
    it: 'Applica revisione'
  },
  'Somente fontes': {
    'en-US': 'Sources only',
    es: 'Solo fuentes',
    fr: 'Sources uniquement',
    de: 'Nur Quellen',
    it: 'Solo fonti'
  },
  'Fontes + conhecimento complementar': {
    'en-US': 'Sources + complementary knowledge',
    es: 'Fuentes + conocimiento complementario',
    fr: 'Sources + connaissances complémentaires',
    de: 'Quellen + ergänzendes Wissen',
    it: 'Fonti + conoscenze complementari'
  },
  'Local (Privado)': {
    'en-US': 'Local (private)',
    es: 'Local (privado)',
    fr: 'Local (privé)',
    de: 'Lokal (privat)',
    it: 'Locale (privato)'
  },
  'Nuvem (envia trechos ao provedor)': {
    'en-US': 'Cloud (sends excerpts to the provider)',
    es: 'Nube (envía fragmentos al proveedor)',
    fr: 'Cloud (envoie des extraits au fournisseur)',
    de: 'Cloud (sendet Auszüge an den Anbieter)',
    it: 'Cloud (invia estratti al fornitore)'
  },
  'Fila': {
    'en-US': 'Queue',
    es: 'Cola',
    fr: 'File',
    de: 'Warteschlange',
    it: 'Coda'
  },

  // Project creation and profiles
  'Perfil Geral': {
    'en-US': 'General profile',
    es: 'Perfil general',
    fr: 'Profil général',
    de: 'Allgemeines Profil',
    it: 'Profilo generale'
  },
  'Estudante (ABNT, Quiz)': {
    'en-US': 'Student (academic papers, quiz)',
    es: 'Estudiante (trabajos académicos, quiz)',
    fr: 'Étudiant (travaux académiques, quiz)',
    de: 'Student (akademische Arbeiten, Quiz)',
    it: 'Studente (tesi, quiz)'
  },
  'Professor (Apostilas, Planos de Aula)': {
    'en-US': 'Teacher (handbooks, lesson plans)',
    es: 'Profesor (apuntes, planes de clase)',
    fr: 'Enseignant (supports de cours, plans de leçon)',
    de: 'Lehrkraft (Skripte, Unterrichtspläne)',
    it: 'Insegnante (dispense, piani di lezione)'
  },
  'Advogado (Ofícios, Timbrados)': {
    'en-US': 'Lawyer (official letters, letterheads)',
    es: 'Abogado (oficios, membretes)',
    fr: 'Avocat (courriers officiels, en-têtes)',
    de: 'Anwalt (amtliche Schreiben, Briefköpfe)',
    it: 'Avvocato (lettere ufficiali, carte intestate)'
  },
  'Servidor Público (Redação Oficial)': {
    'en-US': 'Public servant (official writing)',
    es: 'Funcionario público (redacción oficial)',
    fr: 'Agent public (rédaction officielle)',
    de: 'Verwaltungsangestellter (amtliche Texte)',
    it: 'Funzionario pubblico (scrittura ufficiale)'
  },
  'Executivo (PPTX, Relatórios, Podcast)': {
    'en-US': 'Executive (slides, reports, podcasts)',
    es: 'Ejecutivo (PPTX, informes, podcast)',
    fr: 'Dirigeant (PPTX, rapports, podcast)',
    de: 'Führungskraft (PPTX, Berichte, Podcast)',
    it: 'Dirigente (PPTX, report, podcast)'
  },
  'Geral': {
    'en-US': 'General',
    es: 'General',
    fr: 'Général',
    de: 'Allgemein',
    it: 'Generale'
  },
  'Acadêmico': {
    'en-US': 'Academic',
    es: 'Académico',
    fr: 'Académique',
    de: 'Akademisch',
    it: 'Accademico'
  },
  'Docente': {
    'en-US': 'Teacher',
    es: 'Docente',
    fr: 'Enseignant',
    de: 'Lehrkraft',
    it: 'Insegnante'
  },
  'Jurídico': {
    'en-US': 'Legal',
    es: 'Jurídico',
    fr: 'Juridique',
    de: 'Juristisch',
    it: 'Legale'
  },
  'Oficial': {
    'en-US': 'Official',
    es: 'Oficial',
    fr: 'Officiel',
    de: 'Offiziell',
    it: 'Ufficiale'
  },
  'Executivo': {
    'en-US': 'Executive',
    es: 'Ejecutivo',
    fr: 'Exécutif',
    de: 'Executive',
    it: 'Esecutivo'
  },
  'Slides': {
    'en-US': 'Slides',
    es: 'Diapositivas',
    fr: 'Diapositives',
    de: 'Folien',
    it: 'Diapositive'
  },
  'Planilhas': {
    'en-US': 'Spreadsheets',
    es: 'Hojas de cálculo',
    fr: 'Tableurs',
    de: 'Tabellen',
    it: 'Fogli di calcolo'
  },
  'Áudio & Vídeo': {
    'en-US': 'Audio & video',
    es: 'Audio y vídeo',
    fr: 'Audio et vidéo',
    de: 'Audio und Video',
    it: 'Audio e video'
  },
  'Relatórios': {
    'en-US': 'Reports',
    es: 'Informes',
    fr: 'Rapports',
    de: 'Berichte',
    it: 'Report'
  },
  'Todos': {
    'en-US': 'All',
    es: 'Todos',
    fr: 'Tous',
    de: 'Alle',
    it: 'Tutti'
  },

  // Errors and status messages
  'Falha ao ler arquivo': {
    'en-US': 'Could not read the file',
    es: 'No se pudo leer el archivo',
    fr: 'Impossible de lire le fichier',
    de: 'Datei konnte nicht gelesen werden',
    it: 'Impossibile leggere il file'
  },
  'Erro ao inicializar MomAI Docs': {
    'en-US': 'Could not initialize MomAI Docs',
    es: 'No se pudo iniciar MomAI Docs',
    fr: 'Impossible d’initialiser MomAI Docs',
    de: 'MomAI Docs konnte nicht gestartet werden',
    it: 'Impossibile avviare MomAI Docs'
  },
  'Criando projeto...': {
    'en-US': 'Creating project...',
    es: 'Creando proyecto...',
    fr: 'Création du projet...',
    de: 'Projekt wird erstellt...',
    it: 'Creazione progetto...'
  },
  'Falha ao baixar arquivo.': {
    'en-US': 'Could not download the file.',
    es: 'No se pudo descargar el archivo.',
    fr: 'Impossible de télécharger le fichier.',
    de: 'Datei konnte nicht heruntergeladen werden.',
    it: 'Impossibile scaricare il file.'
  },
  'Erro ao adicionar fonte': {
    'en-US': 'Could not add the source',
    es: 'No se pudo añadir la fuente',
    fr: 'Impossible d’ajouter la source',
    de: 'Quelle konnte nicht hinzugefügt werden',
    it: 'Impossibile aggiungere la fonte'
  },
  'Nenhuma sugestão encontrada para esse termo. Tente palavras-chave mais amplas.': {
    'en-US': 'No suggestions found for that term. Try broader keywords.',
    es: 'No se encontraron sugerencias para ese término. Prueba palabras clave más amplias.',
    fr: 'Aucune suggestion trouvée pour ce terme. Essayez des mots-clés plus larges.',
    de: 'Keine Vorschläge für diesen Begriff gefunden. Versuchen Sie allgemeinere Suchbegriffe.',
    it: 'Nessun suggerimento trovato per questo termine. Prova parole chiave più ampie.'
  },
  'Falha ao buscar fontes.': {
    'en-US': 'Could not search for sources.',
    es: 'No se pudieron buscar fuentes.',
    fr: 'Impossible de rechercher des sources.',
    de: 'Quellen konnten nicht gesucht werden.',
    it: 'Impossibile cercare le fonti.'
  },
  'Buscando fontes confiáveis...': {
    'en-US': 'Searching reliable sources...',
    es: 'Buscando fuentes fiables...',
    fr: 'Recherche de sources fiables...',
    de: 'Verlässliche Quellen werden gesucht...',
    it: 'Ricerca di fonti affidabili...'
  },
  'Documento pronto': {
    'en-US': 'Document ready',
    es: 'Documento listo',
    fr: 'Document prêt',
    de: 'Dokument fertig',
    it: 'Documento pronto'
  },
  'Falha na geração.': {
    'en-US': 'Generation failed.',
    es: 'La generación falló.',
    fr: 'La génération a échoué.',
    de: 'Generierung fehlgeschlagen.',
    it: 'Generazione non riuscita.'
  },
  'O provedor de IA falhou ou ficou sobrecarregado (llm_provider_request_failed). Verifique se o modelo está ativo e tente novamente.': {
    'en-US': 'The AI provider failed or is overloaded (llm_provider_request_failed). Check that the model is active and try again.',
    es: 'El proveedor de IA falló o está sobrecargado (llm_provider_request_failed). Comprueba que el modelo esté activo e inténtalo de nuevo.',
    fr: 'Le fournisseur d’IA a échoué ou est surchargé (llm_provider_request_failed). Vérifiez que le modèle est actif et réessayez.',
    de: 'Der KI-Anbieter ist fehlgeschlagen oder überlastet (llm_provider_request_failed). Prüfen Sie, ob das Modell aktiv ist, und versuchen Sie es erneut.',
    it: 'Il provider AI ha fallito o è sovraccarico (llm_provider_request_failed). Verifica che il modello sia attivo e riprova.'
  },
  'Falha ao refinar artefato.': {
    'en-US': 'Could not refine the artifact.',
    es: 'No se pudo refinar el artefacto.',
    fr: 'Impossible d’affiner l’artefact.',
    de: 'Artefakt konnte nicht verfeinert werden.',
    it: 'Impossibile rifinire l’artefatto.'
  },
  'Refinando artefato...': {
    'en-US': 'Refining artifact...',
    es: 'Refinando artefacto...',
    fr: 'Affinage de l’artefact...',
    de: 'Artefakt wird verfeinert...',
    it: 'Rifinitura dell’artefatto...'
  },
  'Erro ao exportar.': {
    'en-US': 'Could not export.',
    es: 'No se pudo exportar.',
    fr: 'Impossible d’exporter.',
    de: 'Export fehlgeschlagen.',
    it: 'Impossibile esportare.'
  },
  'Envie uma imagem PNG, JPG ou WEBP para o timbre.': {
    'en-US': 'Send a PNG, JPG or WEBP image for the letterhead.',
    es: 'Envía una imagen PNG, JPG o WEBP para el membrete.',
    fr: 'Envoyez une image PNG, JPG ou WEBP pour l’en-tête.',
    de: 'Senden Sie ein PNG-, JPG- oder WEBP-Bild für den Briefkopf.',
    it: 'Invia un’immagine PNG, JPG o WEBP per la carta intestata.'
  },
  'Nenhuma imagem encontrada na área de transferência.': {
    'en-US': 'No image found in the clipboard.',
    es: 'No se encontró ninguna imagen en el portapapeles.',
    fr: 'Aucune image trouvée dans le presse-papiers.',
    de: 'Kein Bild in der Zwischenablage gefunden.',
    it: 'Nessuna immagine trovata negli appunti.'
  },
  'Não foi possível ler a imagem da área de transferência.': {
    'en-US': 'Could not read the image from the clipboard.',
    es: 'No se pudo leer la imagen del portapapeles.',
    fr: 'Impossible de lire l’image du presse-papiers.',
    de: 'Das Bild konnte nicht aus der Zwischenablage gelesen werden.',
    it: 'Impossibile leggere l’immagine dagli appunti.'
  },
  'Não consegui gerar uma resposta agora. Tente novamente.': {
    'en-US': 'I could not generate a response right now. Please try again.',
    es: 'No pude generar una respuesta ahora. Inténtalo de nuevo.',
    fr: 'Je n’ai pas pu générer de réponse pour le moment. Veuillez réessayer.',
    de: 'Ich konnte gerade keine Antwort generieren. Bitte versuchen Sie es erneut.',
    it: 'Non riesco a generare una risposta ora. Riprova.'
  },
  'Erro ao consultar o assistente.': {
    'en-US': 'Could not query the assistant.',
    es: 'Error al consultar al asistente.',
    fr: 'Impossible d’interroger l’assistant.',
    de: 'Assistent konnte nicht abgefragt werden.',
    it: 'Impossibile interrogare l’assistente.'
  },

  // Generation steps and relative dates
  'Lendo arquivos e fontes do projeto': {
    'en-US': 'Reading project files and sources',
    es: 'Leyendo archivos y fuentes del proyecto',
    fr: 'Lecture des fichiers et des sources du projet',
    de: 'Projektdateien und Quellen werden gelesen',
    it: 'Lettura dei file e delle fonti del progetto'
  },
  'Extraindo trechos e citações-chave': {
    'en-US': 'Extracting key passages and citations',
    es: 'Extrayendo fragmentos y citas clave',
    fr: 'Extraction des passages et citations clés',
    de: 'Wichtige Abschnitte und Zitate werden extrahiert',
    it: 'Estrazione di passaggi e citazioni chiave'
  },
  'Aplicando normas e estrutura do modelo': {
    'en-US': 'Applying the template standards and structure',
    es: 'Aplicando las normas y la estructura de la plantilla',
    fr: 'Application des normes et de la structure du modèle',
    de: 'Normen und Struktur der Vorlage werden angewendet',
    it: 'Applicazione delle norme e della struttura del modello'
  },
  'Redigindo o documento completo': {
    'en-US': 'Writing the complete document',
    es: 'Redactando el documento completo',
    fr: 'Rédaction du document complet',
    de: 'Das vollständige Dokument wird verfasst',
    it: 'Redazione del documento completo'
  },
  'Revisando formatação e prévia visual': {
    'en-US': 'Reviewing formatting and visual preview',
    es: 'Revisando el formato y la vista previa visual',
    fr: 'Vérification de la mise en forme et de l’aperçu visuel',
    de: 'Formatierung und visuelle Vorschau werden geprüft',
    it: 'Revisione della formattazione e dell’anteprima visiva'
  },
  'agora': {
    'en-US': 'just now',
    es: 'ahora',
    fr: 'à l’instant',
    de: 'gerade eben',
    it: 'adesso'
  },
  'recente': {
    'en-US': 'recent',
    es: 'reciente',
    fr: 'récemment',
    de: 'vor Kurzem',
    it: 'recente'
  },
  'ontem': {
    'en-US': 'yesterday',
    es: 'ayer',
    fr: 'hier',
    de: 'gestern',
    it: 'ieri'
  },

  // Additional page copy
  '+ Enviar imagens para incluir no documento': {
    'en-US': '+ Send images to include in the document',
    es: '+ Enviar imágenes para incluir en el documento',
    fr: '+ Envoyer des images à inclure dans le document',
    de: '+ Bilder zum Einfügen in das Dokument senden',
    it: '+ Invia immagini da includere nel documento'
  },
  '1 (Solo)': {
    'en-US': '1 (solo)',
    es: '1 (solo)',
    fr: '1 (seul)',
    de: '1 (allein)',
    it: '1 (solo)'
  },
  'Adicionando...': {
    'en-US': 'Adding...',
    es: 'Añadiendo...',
    fr: 'Ajout...',
    de: 'Wird hinzugefügt...',
    it: 'Aggiunta...'
  },
  'Anexar arquivos ou imagens': {
    'en-US': 'Attach files or images',
    es: 'Adjuntar archivos o imágenes',
    fr: 'Joindre des fichiers ou images',
    de: 'Dateien oder Bilder anhängen',
    it: 'Allega file o immagini'
  },
  'Anexos neste documento (imagens PNG/JPG)': {
    'en-US': 'Attachments in this document (PNG/JPG images)',
    es: 'Adjuntos en este documento (imágenes PNG/JPG)',
    fr: 'Pièces jointes dans ce document (images PNG/JPG)',
    de: 'Anhänge in diesem Dokument (PNG/JPG-Bilder)',
    it: 'Allegati in questo documento (immagini PNG/JPG)'
  },
  'Anterior': {
    'en-US': 'Previous',
    es: 'Anterior',
    fr: 'Précédent',
    de: 'Zurück',
    it: 'Precedente'
  },
  'Baixar': {
    'en-US': 'Download',
    es: 'Descargar',
    fr: 'Télécharger',
    de: 'Herunterladen',
    it: 'Scarica'
  },
  'Bibliotecas: docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)': {
    'en-US': 'Libraries: docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)',
    es: 'Bibliotecas: docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)',
    fr: 'Bibliothèques : docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)',
    de: 'Bibliotheken: docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)',
    it: 'Librerie: docx, pdf-lib, pptxgenjs, fflate, unpdf, zod (MIT)'
  },
  'Buscando...': {
    'en-US': 'Searching...',
    es: 'Buscando...',
    fr: 'Recherche...',
    de: 'Suche läuft...',
    it: 'Ricerca...'
  },
  'Buscar': {
    'en-US': 'Search',
    es: 'Buscar',
    fr: 'Rechercher',
    de: 'Suchen',
    it: 'Cerca'
  },
  'Buscar sugestões': {
    'en-US': 'Search suggestions',
    es: 'Buscar sugerencias',
    fr: 'Rechercher des suggestions',
    de: 'Vorschläge suchen',
    it: 'Cerca suggerimenti'
  },
  'Cabeçalho institucional e rodapé': {
    'en-US': 'Institutional header and footer',
    es: 'Encabezado institucional y pie de página',
    fr: 'En-tête institutionnel et pied de page',
    de: 'Institutionelle Kopf- und Fußzeile',
    it: 'Intestazione istituzionale e piè di pagina'
  },
  'Cancelar geração': {
    'en-US': 'Cancel generation',
    es: 'Cancelar generación',
    fr: 'Annuler la génération',
    de: 'Generierung abbrechen',
    it: 'Annulla generazione'
  },
  'Chat': {
    'en-US': 'Chat',
    es: 'Chat',
    fr: 'Chat',
    de: 'Chat',
    it: 'Chat'
  },
  'Colar': {
    'en-US': 'Paste',
    es: 'Pegar',
    fr: 'Coller',
    de: 'Einfügen',
    it: 'Incolla'
  },
  'Cole aqui notas, trechos ou informações de referência...': {
    'en-US': 'Paste notes, excerpts or reference information here...',
    es: 'Pega aquí notas, fragmentos o información de referencia...',
    fr: 'Collez ici des notes, des extraits ou des informations de référence...',
    de: 'Fügen Sie hier Notizen, Auszüge oder Referenzinformationen ein...',
    it: 'Incolla qui note, estratti o informazioni di riferimento...'
  },
  'Cole aqui o texto de referência...': {
    'en-US': 'Paste the reference text here...',
    es: 'Pega aquí el texto de referencia...',
    fr: 'Collez ici le texte de référence...',
    de: 'Fügen Sie hier den Referenztext ein...',
    it: 'Incolla qui il testo di riferimento...'
  },
  'Com Timbre': {
    'en-US': 'With letterhead',
    es: 'Con membrete',
    fr: 'Avec en-tête',
    de: 'Mit Briefkopf',
    it: 'Con carta intestata'
  },
  'Compartilhar': {
    'en-US': 'Share',
    es: 'Compartir',
    fr: 'Partager',
    de: 'Teilen',
    it: 'Condividi'
  },
  'Continuar com {count} fonte(s)': {
    'en-US': 'Continue with {count} source(s)',
    es: 'Continuar con {count} fuente(s)',
    fr: 'Continuer avec {count} source(s)',
    de: 'Mit {count} Quelle(n) fortfahren',
    it: 'Continua con {count} fonte/i'
  },
  'Criar projeto com este modelo': {
    'en-US': 'Create a project with this template',
    es: 'Crear un proyecto con esta plantilla',
    fr: 'Créer un projet avec ce modèle',
    de: 'Projekt mit dieser Vorlage erstellen',
    it: 'Crea un progetto con questo modello'
  },
  'Desafixar do topo': {
    'en-US': 'Unpin from top',
    es: 'Desfijar de arriba',
    fr: 'Désépingler du haut',
    de: 'Oben lösen',
    it: 'Rimuovi dal alto'
  },
  'Descobrir': {
    'en-US': 'Discover',
    es: 'Descubrir',
    fr: 'Découvrir',
    de: 'Entdecken',
    it: 'Scopri'
  },
  'Desmarcar': {
    'en-US': 'Clear selection',
    es: 'Deseleccionar',
    fr: 'Tout désélectionner',
    de: 'Auswahl aufheben',
    it: 'Deseleziona'
  },
  'Direto / Conciso': {
    'en-US': 'Direct / Concise',
    es: 'Directo / Conciso',
    fr: 'Direct / Concis',
    de: 'Direkt / Prägnant',
    it: 'Diretto / Conciso'
  },
  'Documento MomAI Docs': {
    'en-US': 'MomAI Docs document',
    es: 'Documento de MomAI Docs',
    fr: 'Document MomAI Docs',
    de: 'MomAI Docs-Dokument',
    it: 'Documento MomAI Docs'
  },
  'Editar': {
    'en-US': 'Edit',
    es: 'Editar',
    fr: 'Modifier',
    de: 'Bearbeiten',
    it: 'Modifica'
  },
  'Editar título': {
    'en-US': 'Edit title',
    es: 'Editar título',
    fr: 'Modifier le titre',
    de: 'Titel bearbeiten',
    it: 'Modifica titolo'
  },
  'Editar título do projeto': {
    'en-US': 'Edit project title',
    es: 'Editar título del proyecto',
    fr: 'Modifier le titre du projet',
    de: 'Projekttitel bearbeiten',
    it: 'Modifica titolo del progetto'
  },
  'Enviar': {
    'en-US': 'Send',
    es: 'Enviar',
    fr: 'Envoyer',
    de: 'Senden',
    it: 'Invia'
  },
  'Enviar arquivos do computador': {
    'en-US': 'Send files from your computer',
    es: 'Enviar archivos del ordenador',
    fr: 'Envoyer des fichiers depuis votre ordinateur',
    de: 'Dateien vom Computer senden',
    it: 'Invia file dal computer'
  },
  'Envie um documento ou imagem com o timbre da sua instituição para aplicar nos próximos ofícios e relatórios.': {
    'en-US': 'Send a document or image with your institution letterhead to apply it to upcoming letters and reports.',
    es: 'Envía un documento o imagen con el membrete de tu institución para aplicarlo en los próximos oficios e informes.',
    fr: 'Envoyez un document ou une image avec l’en-tête de votre institution pour l’appliquer aux prochains courriers et rapports.',
    de: 'Senden Sie ein Dokument oder Bild mit dem Briefkopf Ihrer Institution, um ihn auf künftige Schreiben und Berichte anzuwenden.',
    it: 'Invia un documento o un’immagine con la carta intestata della tua istituzione per applicarla alle prossime lettere e relazioni.'
  },
  'Escolha um formato para iniciar um novo material': {
    'en-US': 'Choose a format to start a new artifact',
    es: 'Elige un formato para iniciar un nuevo material',
    fr: 'Choisissez un format pour démarrer un nouveau contenu',
    de: 'Wählen Sie ein Format, um ein neues Material zu starten',
    it: 'Scegli un formato per iniziare un nuovo materiale'
  },
  'Estrutura clássica e margens oficiais': {
    'en-US': 'Classic structure and official margins',
    es: 'Estructura clásica y márgenes oficiales',
    fr: 'Structure classique et marges officielles',
    de: 'Klassische Struktur und offizielle Ränder',
    it: 'Struttura classica e margini ufficiali'
  },
  'Estúdio ({count})': {
    'en-US': 'Studio ({count})',
    es: 'Estudio ({count})',
    fr: 'Studio ({count})',
    de: 'Studio ({count})',
    it: 'Studio ({count})'
  },
  'Etapa {current} de {total}': {
    'en-US': 'Step {current} of {total}',
    es: 'Paso {current} de {total}',
    fr: 'Étape {current} sur {total}',
    de: 'Schritt {current} von {total}',
    it: 'Passaggio {current} di {total}'
  },
  'Ex: Deixe o tom mais formal, resuma a conclusão em 3 pontos...': {
    'en-US': 'e.g. Make the tone more formal, summarize the conclusion in 3 points...',
    es: 'Ej: Haz el tono más formal, resume la conclusión en 3 puntos...',
    fr: 'Ex : Rendez le ton plus formel, résumez la conclusion en 3 points...',
    de: 'Z. B.: Formeller formulieren, die Schlussfolgerung in 3 Punkten zusammenfassen...',
    it: 'Es: Rendi il tono più formale, riassumi la conclusione in 3 punti...'
  },
  'Ex: Direcionar ao diretor de obras, tom formal, incluir prazo de 15 dias...': {
    'en-US': 'e.g. Address the works director, formal tone, include a 15-day deadline...',
    es: 'Ej: Dirigir al director de obras, tono formal, incluir plazo de 15 días...',
    fr: 'Ex : Adresser au directeur des travaux, ton formel, inclure un délai de 15 jours...',
    de: 'Z. B.: An den Bauleiter richten, formeller Ton, 15-Tage-Frist angeben...',
    it: 'Es: Indirizzare al direttore dei lavori, tono formale, includere scadenza di 15 giorni...'
  },
  'Fixado no topo': {
    'en-US': 'Pinned to top',
    es: 'Fijado arriba',
    fr: 'Épinglé en haut',
    de: 'Oben angeheftet',
    it: 'Fissato in alto'
  },
  'Fontes ({count})': {
    'en-US': 'Sources ({count})',
    es: 'Fuentes ({count})',
    fr: 'Sources ({count})',
    de: 'Quellen ({count})',
    it: 'Fonti ({count})'
  },
  'Fontes: Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)': {
    'en-US': 'Fonts: Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)',
    es: 'Fuentes: Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)',
    fr: 'Polices : Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)',
    de: 'Schriften: Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)',
    it: 'Font: Inter, Liberation Serif/Sans, Merriweather, JetBrains Mono (SIL OFL 1.1)'
  },
  'Formal Padrão': {
    'en-US': 'Standard formal',
    es: 'Formal estándar',
    fr: 'Formel standard',
    de: 'Standard formell',
    it: 'Formale standard'
  },
  'Gerados ({count})': {
    'en-US': 'Generated ({count})',
    es: 'Generados ({count})',
    fr: 'Générés ({count})',
    de: 'Erstellt ({count})',
    it: 'Generati ({count})'
  },
  'Gerando': {
    'en-US': 'Generating',
    es: 'Generando',
    fr: 'Génération',
    de: 'Wird generiert',
    it: 'Generazione'
  },
  'Incluir legendas (.srt)': {
    'en-US': 'Include subtitles (.srt)',
    es: 'Incluir subtítulos (.srt)',
    fr: 'Inclure des sous-titres (.srt)',
    de: 'Untertitel einfügen (.srt)',
    it: 'Includi sottotitoli (.srt)'
  },
  'Interlocutores': {
    'en-US': 'Speakers',
    es: 'Interlocutores',
    fr: 'Intervenants',
    de: 'Sprecher',
    it: 'Interlocutori'
  },
  'Legendas': {
    'en-US': 'Subtitles',
    es: 'Subtítulos',
    fr: 'Sous-titres',
    de: 'Untertitel',
    it: 'Sottotitoli'
  },
  'Listar citações': {
    'en-US': 'List citations',
    es: 'Listar citas',
    fr: 'Lister les citations',
    de: 'Zitate auflisten',
    it: 'Elenca citazioni'
  },
  'Marcar como revisado pela IA': {
    'en-US': 'Mark as AI-reviewed',
    es: 'Marcar como revisado por IA',
    fr: 'Marquer comme relu par l’IA',
    de: 'Als KI-geprüft markieren',
    it: 'Contrassegna come revisionato dall’IA'
  },
  'Modelos': {
    'en-US': 'Models',
    es: 'Modelos',
    fr: 'Modèles',
    de: 'Modelle',
    it: 'Modelli'
  },
  'Modelos e Formatos': {
    'en-US': 'Models and formats',
    es: 'Modelos y formatos',
    fr: 'Modèles et formats',
    de: 'Modelle und Formate',
    it: 'Modelli e formati'
  },
  'Mostrar barra lateral': {
    'en-US': 'Show sidebar',
    es: 'Mostrar barra lateral',
    fr: 'Afficher la barre latérale',
    de: 'Seitenleiste anzeigen',
    it: 'Mostra barra laterale'
  },
  'Nome do projeto (ex: Ofício prefeitura)': {
    'en-US': 'Project name (e.g. City hall letter)',
    es: 'Nombre del proyecto (ej: Oficio ayuntamiento)',
    fr: 'Nom du projet (ex : Courrier mairie)',
    de: 'Projektname (z. B. Schreiben Stadtverwaltung)',
    it: 'Nome del progetto (es: Lettera comune)'
  },
  'Novo': {
    'en-US': 'New',
    es: 'Nuevo',
    fr: 'Nouveau',
    de: 'Neu',
    it: 'Nuovo'
  },
  'Novo título do projeto': {
    'en-US': 'New project title',
    es: 'Nuevo título del proyecto',
    fr: 'Nouveau titre du projet',
    de: 'Neuer Projekttitel',
    it: 'Nuovo titolo del progetto'
  },
  'Novo título...': {
    'en-US': 'New title...',
    es: 'Nuevo título...',
    fr: 'Nouveau titre...',
    de: 'Neuer Titel...',
    it: 'Nuovo titolo...'
  },
  'O resultado do Estúdio será salvo aqui': {
    'en-US': 'Studio results will be saved here',
    es: 'El resultado del Estudio se guardará aquí',
    fr: 'Le résultat du Studio sera enregistré ici',
    de: 'Studio-Ergebnisse werden hier gespeichert',
    it: 'Il risultato dello Studio sarà salvato qui'
  },
  'Ocultar barra lateral': {
    'en-US': 'Hide sidebar',
    es: 'Ocultar barra lateral',
    fr: 'Masquer la barre latérale',
    de: 'Seitenleiste ausblenden',
    it: 'Nascondi barra laterale'
  },
  'PDF, DOCX, PPTX, XLSX, TXT ou Markdown': {
    'en-US': 'PDF, DOCX, PPTX, XLSX, TXT or Markdown',
    es: 'PDF, DOCX, PPTX, XLSX, TXT o Markdown',
    fr: 'PDF, DOCX, PPTX, XLSX, TXT ou Markdown',
    de: 'PDF, DOCX, PPTX, XLSX, TXT oder Markdown',
    it: 'PDF, DOCX, PPTX, XLSX, TXT o Markdown'
  },
  'PDF, DOCX, XLSX, PPTX, TXT': {
    'en-US': 'PDF, DOCX, XLSX, PPTX, TXT',
    es: 'PDF, DOCX, XLSX, PPTX, TXT',
    fr: 'PDF, DOCX, XLSX, PPTX, TXT',
    de: 'PDF, DOCX, XLSX, PPTX, TXT',
    it: 'PDF, DOCX, XLSX, PPTX, TXT'
  },
  'Parado': {
    'en-US': 'Stopped',
    es: 'Detenido',
    fr: 'Arrêté',
    de: 'Gestoppt',
    it: 'Fermato'
  },
  'Parar resposta': {
    'en-US': 'Stop answer',
    es: 'Detener respuesta',
    fr: 'Arrêter la réponse',
    de: 'Antwort stoppen',
    it: 'Interrompi risposta'
  },
  'Pontos principais': {
    'en-US': 'Key points',
    es: 'Puntos principales',
    fr: 'Points clés',
    de: 'Kernpunkte',
    it: 'Punti principali'
  },
  'Processando...': {
    'en-US': 'Processing...',
    es: 'Procesando...',
    fr: 'Traitement...',
    de: 'Wird verarbeitet...',
    it: 'Elaborazione...'
  },
  'Página {current} de {total}': {
    'en-US': 'Page {current} of {total}',
    es: 'Página {current} de {total}',
    fr: 'Page {current} sur {total}',
    de: 'Seite {current} von {total}',
    it: 'Pagina {current} di {total}'
  },
  'QA Visual aprovado': {
    'en-US': 'Visual QA passed',
    es: 'QA visual aprobado',
    fr: 'Contrôle visuel validé',
    de: 'Visuelle Prüfung bestanden',
    it: 'QA visiva superata'
  },
  'QA Visual auto-reparado': {
    'en-US': 'Visual QA auto-repaired',
    es: 'QA visual auto-reparado',
    fr: 'Contrôle visuel auto-réparé',
    de: 'Visuelle Prüfung automatisch repariert',
    it: 'QA visiva auto-riparata'
  },
  'Quantidade de interlocutores': {
    'en-US': 'Number of speakers',
    es: 'Cantidad de interlocutores',
    fr: 'Nombre d’intervenants',
    de: 'Anzahl der Sprecher',
    it: 'Numero di interlocutori'
  },
  'Recentes': {
    'en-US': 'Recent',
    es: 'Recientes',
    fr: 'Récents',
    de: 'Aktuell',
    it: 'Recenti'
  },
  'Refinando...': {
    'en-US': 'Refining...',
    es: 'Refinando...',
    fr: 'Affinage...',
    de: 'Wird verfeinert...',
    it: 'Rifinitura...'
  },
  'Remover anexo': {
    'en-US': 'Remove attachment',
    es: 'Quitar adjunto',
    fr: 'Retirer la pièce jointe',
    de: 'Anhang entfernen',
    it: 'Rimuovi allegato'
  },
  'Renomear arquivo': {
    'en-US': 'Rename file',
    es: 'Renombrar archivo',
    fr: 'Renommer le fichier',
    de: 'Datei umbenennen',
    it: 'Rinomina file'
  },
  'Resposta interrompida': {
    'en-US': 'Response interrupted',
    es: 'Respuesta interrumpida',
    fr: 'Réponse interrompue',
    de: 'Antwort unterbrochen',
    it: 'Risposta interrotta'
  },
  'Resumir as fontes': {
    'en-US': 'Summarize the sources',
    es: 'Resumir las fuentes',
    fr: 'Résumer les sources',
    de: 'Quellen zusammenfassen',
    it: 'Riassumi le fonti'
  },
  'Role para carregar mais...': {
    'en-US': 'Scroll to load more...',
    es: 'Desplázate para cargar más...',
    fr: 'Faites défiler pour charger la suite...',
    de: 'Scrollen Sie, um mehr zu laden...',
    it: 'Scorri per caricare altro...'
  },
  'Salvar título': {
    'en-US': 'Save title',
    es: 'Guardar título',
    fr: 'Enregistrer le titre',
    de: 'Titel speichern',
    it: 'Salva titolo'
  },
  'Selecionar': {
    'en-US': 'Select',
    es: 'Seleccionar',
    fr: 'Sélectionner',
    de: 'Auswählen',
    it: 'Seleziona'
  },
  'Selecionar tudo': {
    'en-US': 'Select all',
    es: 'Seleccionar todo',
    fr: 'Tout sélectionner',
    de: 'Alle auswählen',
    it: 'Seleziona tutto'
  },
  'Sem legendas': {
    'en-US': 'No subtitles',
    es: 'Sin subtítulos',
    fr: 'Sans sous-titres',
    de: 'Ohne Untertitel',
    it: 'Senza sottotitoli'
  },
  'Sem timbre · foco em leitura rápida': {
    'en-US': 'No letterhead · focused on quick reading',
    es: 'Sin membrete · enfoque en lectura rápida',
    fr: 'Sans en-tête · lecture rapide',
    de: 'Ohne Briefkopf · Fokus auf schnelles Lesen',
    it: 'Senza carta intestata · lettura rapida'
  },
  'Status de qualidade': {
    'en-US': 'Quality status',
    es: 'Estado de calidad',
    fr: 'État de qualité',
    de: 'Qualitätsstatus',
    it: 'Stato di qualità'
  },
  'Tema para buscar artigos e referências confiáveis...': {
    'en-US': 'Topic to find reliable articles and references...',
    es: 'Tema para buscar artículos y referencias fiables...',
    fr: 'Sujet pour trouver des articles et références fiables...',
    de: 'Thema, um verlässliche Artikel und Referenzen zu finden...',
    it: 'Tema per cercare articoli e riferimenti affidabili...'
  },
  'Tema para buscar artigos e referências...': {
    'en-US': 'Topic to find articles and references...',
    es: 'Tema para buscar artículos y referencias...',
    fr: 'Sujet pour trouver des articles et références...',
    de: 'Thema, um Artikel und Referenzen zu finden...',
    it: 'Tema per cercare articoli e riferimenti...'
  },
  'Templates MomAI Docs: MIT (referência estrutural abnTeX2 LPPL 1.3c na ABNT)': {
    'en-US': 'MomAI Docs templates: MIT (structural reference to abnTeX2 LPPL 1.3c for ABNT)',
    es: 'Plantillas de MomAI Docs: MIT (referencia estructural abnTeX2 LPPL 1.3c en ABNT)',
    fr: 'Modèles MomAI Docs : MIT (référence structurelle abnTeX2 LPPL 1.3c pour ABNT)',
    de: 'MomAI Docs-Vorlagen: MIT (strukturelle Referenz zu abnTeX2 LPPL 1.3c für ABNT)',
    it: 'Modelli MomAI Docs: MIT (riferimento strutturale abnTeX2 LPPL 1.3c per ABNT)'
  },
  'Timbre': {
    'en-US': 'Letterhead',
    es: 'Membrete',
    fr: 'En-tête',
    de: 'Briefkopf',
    it: 'Carta intestata'
  },
  'Timbre base': {
    'en-US': 'Base letterhead',
    es: 'Membrete base',
    fr: 'En-tête de base',
    de: 'Basis-Briefkopf',
    it: 'Carta intestata base'
  },
  'Timbre carregado:': {
    'en-US': 'Letterhead loaded:',
    es: 'Membrete cargado:',
    fr: 'En-tête chargé :',
    de: 'Briefkopf geladen:',
    it: 'Carta intestata caricata:'
  },
  'Timbre e identidade visual': {
    'en-US': 'Letterhead and visual identity',
    es: 'Membrete e identidad visual',
    fr: 'En-tête et identité visuelle',
    de: 'Briefkopf und visuelle Identität',
    it: 'Carta intestata e identità visiva'
  },
  'Todos os modelos ({count})': {
    'en-US': 'All models ({count})',
    es: 'Todos los modelos ({count})',
    fr: 'Tous les modèles ({count})',
    de: 'Alle Modelle ({count})',
    it: 'Tutti i modelli ({count})'
  },
  'Todos os templates, fontes tipográficas e ícones permitem uso comercial:': {
    'en-US': 'All templates, typefaces and icons allow commercial use:',
    es: 'Todas las plantillas, fuentes tipográficas e iconos permiten uso comercial:',
    fr: 'Tous les modèles, polices et icônes autorisent un usage commercial :',
    de: 'Alle Vorlagen, Schriften und Symbole erlauben die kommerzielle Nutzung:',
    it: 'Tutti i modelli, i caratteri e le icone consentono l’uso commerciale:'
  },
  'URL / YouTube': {
    'en-US': 'URL / YouTube',
    es: 'URL / YouTube',
    fr: 'URL / YouTube',
    de: 'URL / YouTube',
    it: 'URL / YouTube'
  },
  'Usar no projeto atual': {
    'en-US': 'Use in current project',
    es: 'Usar en el proyecto actual',
    fr: 'Utiliser dans le projet actuel',
    de: 'Im aktuellen Projekt verwenden',
    it: 'Usa nel progetto attuale'
  },
  'Ver todas as {count} opções': {
    'en-US': 'See all {count} options',
    es: 'Ver todas las {count} opciones',
    fr: 'Voir les {count} options',
    de: 'Alle {count} Optionen anzeigen',
    it: 'Vedi tutte le {count} opzioni'
  },
  'Ver todos ({count})': {
    'en-US': 'See all ({count})',
    es: 'Ver todos ({count})',
    fr: 'Tout voir ({count})',
    de: 'Alle anzeigen ({count})',
    it: 'Vedi tutti ({count})'
  },
  'Voz A': {
    'en-US': 'Voice A',
    es: 'Voz A',
    fr: 'Voix A',
    de: 'Stimme A',
    it: 'Voce A'
  },
  'Voz A (Auto)': {
    'en-US': 'Voice A (auto)',
    es: 'Voz A (auto)',
    fr: 'Voix A (auto)',
    de: 'Stimme A (auto)',
    it: 'Voce A (auto)'
  },
  'Voz B': {
    'en-US': 'Voice B',
    es: 'Voz B',
    fr: 'Voix B',
    de: 'Stimme B',
    it: 'Voce B'
  },
  'Voz B (Auto)': {
    'en-US': 'Voice B (auto)',
    es: 'Voz B (auto)',
    fr: 'Voix B (auto)',
    de: 'Stimme B (auto)',
    it: 'Voce B (auto)'
  },
  'Workspace': {
    'en-US': 'Workspace',
    es: 'Espacio de trabajo',
    fr: 'Espace de travail',
    de: 'Arbeitsbereich',
    it: 'Area di lavoro'
  },
  'aguardando': {
    'en-US': 'waiting',
    es: 'esperando',
    fr: 'en attente',
    de: 'wartet',
    it: 'in attesa'
  },
  'em andamento': {
    'en-US': 'in progress',
    es: 'en curso',
    fr: 'en cours',
    de: 'läuft',
    it: 'in corso'
  },
  'https://...': {
    'en-US': 'https://...',
    es: 'https://...',
    fr: 'https://...',
    de: 'https://...',
    it: 'https://...'
  },
  'https://... ou link do YouTube': {
    'en-US': 'https://... or a YouTube link',
    es: 'https://... o enlace de YouTube',
    fr: 'https://... ou un lien YouTube',
    de: 'https://... oder ein YouTube-Link',
    it: 'https://... o un link YouTube'
  },
  'há {n} d': {
    'en-US': '{n}d ago',
    es: 'hace {n} d',
    fr: 'il y a {n} j',
    de: 'vor {n} T',
    it: '{n} g fa'
  },
  'há {n} h': {
    'en-US': '{n}h ago',
    es: 'hace {n} h',
    fr: 'il y a {n} h',
    de: 'vor {n} Std.',
    it: '{n} h fa'
  },
  'há {n} min': {
    'en-US': '{n} min ago',
    es: 'hace {n} min',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    it: '{n} min fa'
  },
  'trechos': {
    'en-US': 'excerpts',
    es: 'fragmentos',
    fr: 'extraits',
    de: 'Auszüge',
    it: 'estratti'
  },
  '{sources} fontes · {artifacts} documentos · {profile}': {
    'en-US': '{sources} sources · {artifacts} documents · {profile}',
    es: '{sources} fuentes · {artifacts} documentos · {profile}',
    fr: '{sources} sources · {artifacts} documents · {profile}',
    de: '{sources} Quellen · {artifacts} Dokumente · {profile}',
    it: '{sources} fonti · {artifacts} documenti · {profile}'
  },
  '{title} foi gerado no MomAI Docs.': {
    'en-US': '{title} was generated in MomAI Docs.',
    es: '{title} se generó en MomAI Docs.',
    fr: '{title} a été généré dans MomAI Docs.',
    de: '{title} wurde in MomAI Docs erstellt.',
    it: '{title} è stato generato in MomAI Docs.'
  },
  'Ícones: SVG internos inspirados em Lucide (ISC)': {
    'en-US': 'Icons: internal SVGs inspired by Lucide (ISC)',
    es: 'Iconos: SVG internos inspirados en Lucide (ISC)',
    fr: 'Icônes : SVG internes inspirés de Lucide (ISC)',
    de: 'Symbole: interne SVGs inspiriert von Lucide (ISC)',
    it: 'Icone: SVG interni ispirati a Lucide (ISC)'
  },
  '1. Fontes ({count})': {
    'en-US': '1. Sources ({count})',
    es: '1. Fuentes ({count})',
    fr: '1. Sources ({count})',
    de: '1. Quellen ({count})',
    it: '1. Fonti ({count})'
  },
  'Fontes adicionadas ({count})': {
    'en-US': 'Sources added ({count})',
    es: 'Fuentes añadidas ({count})',
    fr: 'Sources ajoutées ({count})',
    de: 'Hinzugefügte Quellen ({count})',
    it: 'Fonti aggiunte ({count})'
  },
  'Excluir ({count})': {
    'en-US': 'Delete ({count})',
    es: 'Eliminar ({count})',
    fr: 'Supprimer ({count})',
    de: 'Löschen ({count})',
    it: 'Elimina ({count})'
  },

  // Shared preview and carousel copy
  'Diminuir zoom': {
    'en-US': 'Zoom out',
    es: 'Reducir zoom',
    fr: 'Réduire le zoom',
    de: 'Verkleinern',
    it: 'Riduci zoom'
  },
  'Redefinir zoom para 100%': {
    'en-US': 'Reset zoom to 100%',
    es: 'Restablecer zoom al 100%',
    fr: 'Rétablir le zoom à 100 %',
    de: 'Zoom auf 100 % zurücksetzen',
    it: 'Reimposta zoom al 100%'
  },
  'Aumentar zoom': {
    'en-US': 'Zoom in',
    es: 'Aumentar zoom',
    fr: 'Agrandir le zoom',
    de: 'Vergrößern',
    it: 'Aumenta zoom'
  },
  'Editar timbre': {
    'en-US': 'Edit letterhead',
    es: 'Editar membrete',
    fr: 'Modifier l’en-tête',
    de: 'Briefkopf bearbeiten',
    it: 'Modifica carta intestata'
  },
  'Usar': {
    'en-US': 'Use',
    es: 'Usar',
    fr: 'Utiliser',
    de: 'Verwenden',
    it: 'Usa'
  },
  'Fechar prévia': {
    'en-US': 'Close preview',
    es: 'Cerrar vista previa',
    fr: 'Fermer l’aperçu',
    de: 'Vorschau schließen',
    it: 'Chiudi anteprima'
  },
  'Página anterior': {
    'en-US': 'Previous page',
    es: 'Página anterior',
    fr: 'Page précédente',
    de: 'Vorherige Seite',
    it: 'Pagina precedente'
  },
  'Próxima página': {
    'en-US': 'Next page',
    es: 'Página siguiente',
    fr: 'Page suivante',
    de: 'Nächste Seite',
    it: 'Pagina successiva'
  },
  'Escolher estilo visual': {
    'en-US': 'Choose visual style',
    es: 'Elegir estilo visual',
    fr: 'Choisir le style visuel',
    de: 'Visuellen Stil wählen',
    it: 'Scegli stile visivo'
  },
  'Rolar para esquerda': {
    'en-US': 'Scroll left',
    es: 'Desplazar a la izquierda',
    fr: 'Faire défiler à gauche',
    de: 'Nach links scrollen',
    it: 'Scorri a sinistra'
  },
  'Rolar para direita': {
    'en-US': 'Scroll right',
    es: 'Desplazar a la derecha',
    fr: 'Faire défiler à droite',
    de: 'Nach rechts scrollen',
    it: 'Scorri a destra'
  },
  'Seleção automática': {
    'en-US': 'Automatic selection',
    es: 'Selección automática',
    fr: 'Sélection automatique',
    de: 'Automatische Auswahl',
    it: 'Selezione automatica'
  },
  'Estilo selecionado': {
    'en-US': 'Selected style',
    es: 'Estilo seleccionado',
    fr: 'Style sélectionné',
    de: 'Ausgewählter Stil',
    it: 'Stile selezionato'
  },
  'Meu Timbre': {
    'en-US': 'My letterhead',
    es: 'Mi membrete',
    fr: 'Mon en-tête',
    de: 'Mein Briefkopf',
    it: 'La mia carta intestata'
  },
  'Timbre: {name}': {
    'en-US': 'Letterhead: {name}',
    es: 'Membrete: {name}',
    fr: 'En-tête : {name}',
    de: 'Briefkopf: {name}',
    it: 'Carta intestata: {name}'
  },
  'Usa sua identidade visual (cores, fontes, logo e cabeçalho) com liberdade criativa no layout.': {
    'en-US': 'Uses your visual identity (colors, fonts, logo and header) with creative freedom in the layout.',
    es: 'Usa tu identidad visual (colores, fuentes, logo y encabezado) con libertad creativa en el diseño.',
    fr: 'Utilise votre identité visuelle (couleurs, polices, logo et en-tête) avec une liberté créative dans la mise en page.',
    de: 'Verwendet Ihre visuelle Identität (Farben, Schriften, Logo und Kopfzeile) mit gestalterischer Freiheit im Layout.',
    it: 'Usa la tua identità visiva (colori, font, logo e intestazione) con libertà creativa nel layout.'
  },
  '{name} — Clique para visualizar e usar': {
    'en-US': '{name} — Click to preview and use',
    es: '{name} — Haz clic para ver y usar',
    fr: '{name} — Cliquez pour prévisualiser et utiliser',
    de: '{name} — Klicken zum Ansehen und Verwenden',
    it: '{name} — Fai clic per visualizzare e usare'
  },
  '{count} projetos': {
    'en-US': '{count} projects',
    es: '{count} proyectos',
    fr: '{count} projets',
    de: '{count} Projekte',
    it: '{count} progetti'
  },

  // Template categories
  'oficial': {
    'en-US': 'Official',
    es: 'Oficial',
    fr: 'Officiel',
    de: 'Offiziell',
    it: 'Ufficiale'
  },
  'corporativo': {
    'en-US': 'Corporate',
    es: 'Corporativo',
    fr: 'Entreprise',
    de: 'Unternehmen',
    it: 'Aziendale'
  },
  'academico': {
    'en-US': 'Academic',
    es: 'Académico',
    fr: 'Académique',
    de: 'Akademisch',
    it: 'Accademico'
  },
  'educacao': {
    'en-US': 'Education',
    es: 'Educación',
    fr: 'Éducation',
    de: 'Bildung',
    it: 'Istruzione'
  },
  'tecnico': {
    'en-US': 'Technical',
    es: 'Técnico',
    fr: 'Technique',
    de: 'Technisch',
    it: 'Tecnico'
  },
  'juridico': {
    'en-US': 'Legal',
    es: 'Jurídico',
    fr: 'Juridique',
    de: 'Juristisch',
    it: 'Legale'
  },
  'geral': {
    'en-US': 'General',
    es: 'General',
    fr: 'Général',
    de: 'Allgemein',
    it: 'Generale'
  },
  'dados': {
    'en-US': 'Data',
    es: 'Datos',
    fr: 'Données',
    de: 'Daten',
    it: 'Dati'
  },
  'audio': {
    'en-US': 'Audio',
    es: 'Audio',
    fr: 'Audio',
    de: 'Audio',
    it: 'Audio'
  },
  'social': {
    'en-US': 'Social',
    es: 'Social',
    fr: 'Social',
    de: 'Social',
    it: 'Social'
  },
  'carreira': {
    'en-US': 'Career',
    es: 'Carrera',
    fr: 'Carrière',
    de: 'Karriere',
    it: 'Carriera'
  },
  'comunicacao': {
    'en-US': 'Communication',
    es: 'Comunicación',
    fr: 'Communication',
    de: 'Kommunikation',
    it: 'Comunicazione'
  },
  'minimal': {
    'en-US': 'Minimal',
    es: 'Minimalista',
    fr: 'Minimal',
    de: 'Minimal',
    it: 'Minimal'
  },
  'moderno': {
    'en-US': 'Modern',
    es: 'Moderno',
    fr: 'Moderne',
    de: 'Modern',
    it: 'Moderno'
  },
  'criativo': {
    'en-US': 'Creative',
    es: 'Creativo',
    fr: 'Créatif',
    de: 'Kreativ',
    it: 'Creativo'
  },
  'editorial': {
    'en-US': 'Editorial',
    es: 'Editorial',
    fr: 'Éditorial',
    de: 'Redaktionell',
    it: 'Editoriale'
  },
  'timbre': {
    'en-US': 'Letterhead',
    es: 'Membrete',
    fr: 'En-tête',
    de: 'Briefkopf',
    it: 'Carta intestata'
  },

  // Generated document labels and runtime progress
  'Ofício nº 001/2026': {
    'en-US': 'Letter No. 001/2026',
    es: 'Oficio n.º 001/2026',
    fr: 'Courrier n° 001/2026',
    de: 'Schreiben Nr. 001/2026',
    it: 'Lettera n. 001/2026'
  },
  'Assunto:': {
    'en-US': 'Subject:',
    es: 'Asunto:',
    fr: 'Objet :',
    de: 'Betreff:',
    it: 'Oggetto:'
  },
  'Atenciosamente,': {
    'en-US': 'Sincerely,',
    es: 'Atentamente,',
    fr: 'Cordialement,',
    de: 'Mit freundlichen Grüßen',
    it: 'Cordiali saluti,'
  },
  'Trabalho Acadêmico': {
    'en-US': 'Academic Paper',
    es: 'Trabajo académico',
    fr: 'Travail académique',
    de: 'Akademische Arbeit',
    it: 'Elaborato accademico'
  },
  'Autor:': {
    'en-US': 'Author:',
    es: 'Autor:',
    fr: 'Auteur :',
    de: 'Autor:',
    it: 'Autore:'
  },
  'RESUMO': {
    'en-US': 'ABSTRACT',
    es: 'RESUMEN',
    fr: 'RÉSUMÉ',
    de: 'ZUSAMMENFASSUNG',
    it: 'RIASSUNTO'
  },
  'Palavras-chave:': {
    'en-US': 'Keywords:',
    es: 'Palabras clave:',
    fr: 'Mots-clés :',
    de: 'Schlagwörter:',
    it: 'Parole chiave:'
  },
  'REFERÊNCIAS': {
    'en-US': 'REFERENCES',
    es: 'REFERENCIAS',
    fr: 'RÉFÉRENCES',
    de: 'LITERATURVERZEICHNIS',
    it: 'RIFERIMENTI'
  },
  'Apostila Didática': {
    'en-US': 'Course Handbook',
    es: 'Apunte didáctico',
    fr: 'Support de cours',
    de: 'Unterrichtsskript',
    it: 'Dispensa didattica'
  },
  'Capítulo': {
    'en-US': 'Chapter',
    es: 'Capítulo',
    fr: 'Chapitre',
    de: 'Kapitel',
    it: 'Capitolo'
  },
  'Objetivos:': {
    'en-US': 'Objectives:',
    es: 'Objetivos:',
    fr: 'Objectifs :',
    de: 'Ziele:',
    it: 'Obiettivi:'
  },
  'Exercícios de Fixação': {
    'en-US': 'Practice Exercises',
    es: 'Ejercicios de refuerzo',
    fr: 'Exercices de consolidation',
    de: 'Übungsaufgaben',
    it: 'Esercizi di consolidamento'
  },
  'Gabarito:': {
    'en-US': 'Answer key:',
    es: 'Solucionario:',
    fr: 'Corrigé :',
    de: 'Lösung:',
    it: 'Soluzione:'
  },
  'Glossário': {
    'en-US': 'Glossary',
    es: 'Glosario',
    fr: 'Glossaire',
    de: 'Glossar',
    it: 'Glossario'
  },
  'Referências': {
    'en-US': 'References',
    es: 'Referencias',
    fr: 'Références',
    de: 'Literaturverzeichnis',
    it: 'Riferimenti'
  },
  'Documento': {
    'en-US': 'Document',
    es: 'Documento',
    fr: 'Document',
    de: 'Dokument',
    it: 'Documento'
  },
  'Indicador': {
    'en-US': 'Indicator',
    es: 'Indicador',
    fr: 'Indicateur',
    de: 'Kennzahl',
    it: 'Indicatore'
  },
  'Valor': {
    'en-US': 'Value',
    es: 'Valor',
    fr: 'Valeur',
    de: 'Wert',
    it: 'Valore'
  },
  'Tendência': {
    'en-US': 'Trend',
    es: 'Tendencia',
    fr: 'Tendance',
    de: 'Trend',
    it: 'Tendenza'
  },
  'Cláusula {number}': {
    'en-US': 'Clause {number}',
    es: 'Cláusula {number}',
    fr: 'Clause {number}',
    de: 'Klausel {number}',
    it: 'Clausola {number}'
  },
  'Recomendações': {
    'en-US': 'Recommendations',
    es: 'Recomendaciones',
    fr: 'Recommandations',
    de: 'Empfehlungen',
    it: 'Raccomandazioni'
  },
  'Anexos': {
    'en-US': 'Attachments',
    es: 'Anexos',
    fr: 'Annexes',
    de: 'Anhänge',
    it: 'Allegati'
  },
  'Apresentação MomAI Docs': {
    'en-US': 'MomAI Docs Presentation',
    es: 'Presentación de MomAI Docs',
    fr: 'Présentation MomAI Docs',
    de: 'MomAI Docs-Präsentation',
    it: 'Presentazione MomAI Docs'
  },
  'Apresentação': {
    'en-US': 'Presentation',
    es: 'Presentación',
    fr: 'Présentation',
    de: 'Präsentation',
    it: 'Presentazione'
  },
  'Dados': {
    'en-US': 'Data',
    es: 'Datos',
    fr: 'Données',
    de: 'Daten',
    it: 'Dati'
  },
  'Carregando template e capacidades do modelo...': {
    'en-US': 'Loading template and model capabilities...',
    es: 'Cargando plantilla y capacidades del modelo...',
    fr: 'Chargement du modèle et des capacités du modèle...',
    de: 'Vorlage und Modellfähigkeiten werden geladen...',
    it: 'Caricamento del modello e delle capacità del modello...'
  },
  'Buscando trechos relevantes nas fontes (Gemma Embedding + FTS5)...': {
    'en-US': 'Finding relevant passages in the sources (Gemma Embedding + FTS5)...',
    es: 'Buscando fragmentos relevantes en las fuentes (Gemma Embedding + FTS5)...',
    fr: 'Recherche des passages pertinents dans les sources (Gemma Embedding + FTS5)...',
    de: 'Relevante Abschnitte in den Quellen werden gesucht (Gemma Embedding + FTS5)...',
    it: 'Ricerca di passaggi rilevanti nelle fonti (Gemma Embedding + FTS5)...'
  },
  'Estruturando outline fundamentado nas fontes...': {
    'en-US': 'Structuring an outline grounded in the sources...',
    es: 'Estructurando un esquema basado en las fuentes...',
    fr: 'Structuration d’un plan fondé sur les sources...',
    de: 'Gliederung auf Basis der Quellen wird erstellt...',
    it: 'Strutturazione di una scaletta basata sulle fonti...'
  },
  'Redigindo conteúdo estruturado e validando schema...': {
    'en-US': 'Writing structured content and validating the schema...',
    es: 'Redactando contenido estructurado y validando el esquema...',
    fr: 'Rédaction du contenu structuré et validation du schéma...',
    de: 'Strukturierter Inhalt wird verfasst und das Schema validiert...',
    it: 'Redazione dei contenuti strutturati e validazione dello schema...'
  },
  'Renderizando artefato final e pré-visualizações...': {
    'en-US': 'Rendering the final artifact and previews...',
    es: 'Renderizando el artefacto final y las vistas previas...',
    fr: 'Rendu de l’artefact final et des aperçus...',
    de: 'Endgültiges Artefakt und Vorschauen werden gerendert...',
    it: 'Rendering dell’artefatto finale e delle anteprime...'
  },
  'Executando checagem de qualidade visual automática...': {
    'en-US': 'Running automatic visual quality checks...',
    es: 'Ejecutando la comprobación automática de calidad visual...',
    fr: 'Exécution du contrôle automatique de qualité visuelle...',
    de: 'Automatische visuelle Qualitätsprüfung wird ausgeführt...',
    it: 'Esecuzione del controllo automatico di qualità visiva...'
  },
  'Artefato pronto!': {
    'en-US': 'Artifact ready!',
    es: '¡Artefacto listo!',
    fr: 'Artefact prêt !',
    de: 'Artefakt fertig!',
    it: 'Artefatto pronto!'
  },
  'Na fila para geração...': {
    'en-US': 'Queued for generation...',
    es: 'En cola para generación...',
    fr: 'En file pour la génération...',
    de: 'In der Warteschlange zur Generierung...',
    it: 'In coda per la generazione...'
  },
  '{count} citações': {
    'en-US': '{count} citations',
    es: '{count} citas',
    fr: '{count} citations',
    de: '{count} Zitate',
    it: '{count} citazioni'
  },
  'Geração inicial': {
    'en-US': 'Initial generation',
    es: 'Generación inicial',
    fr: 'Génération initiale',
    de: 'Erstgenerierung',
    it: 'Generazione iniziale'
  },
  'Fonte sem título': {
    'en-US': 'Untitled source',
    es: 'Fuente sin título',
    fr: 'Source sans titre',
    de: 'Unbenannte Quelle',
    it: 'Fonte senza titolo'
  },
  'Página web sugerida': {
    'en-US': 'Suggested web page',
    es: 'Página web sugerida',
    fr: 'Page web suggérée',
    de: 'Vorgeschlagene Webseite',
    it: 'Pagina web suggerita'
  },
  'Artigo da Wikipédia ({lang})': {
    'en-US': 'Wikipedia article ({lang})',
    es: 'Artículo de Wikipedia ({lang})',
    fr: 'Article Wikipédia ({lang})',
    de: 'Wikipedia-Artikel ({lang})',
    it: 'Articolo di Wikipedia ({lang})'
  },
  'Vídeo MomAI Docs': {
    'en-US': 'MomAI Docs Video',
    es: 'Vídeo de MomAI Docs',
    fr: 'Vidéo MomAI Docs',
    de: 'MomAI Docs-Video',
    it: 'Video MomAI Docs'
  },
  'Mapa Mental': {
    'en-US': 'Mind Map',
    es: 'Mapa mental',
    fr: 'Carte mentale',
    de: 'Mindmap',
    it: 'Mappa mentale'
  },

  // Runtime and validation errors
  'Analise os anexos enviados.': {
    'en-US': 'Analyze the attached files.',
    es: 'Analiza los archivos adjuntos.',
    fr: 'Analysez les fichiers joints.',
    de: 'Analysieren Sie die angehängten Dateien.',
    it: 'Analizza i file allegati.'
  },
  'Nota {time}': {
    'en-US': 'Note {time}',
    es: 'Nota {time}',
    fr: 'Note {time}',
    de: 'Notiz {time}',
    it: 'Nota {time}'
  },
  'Exportando {format}...': {
    'en-US': 'Exporting {format}...',
    es: 'Exportando {format}...',
    fr: 'Export de {format}...',
    de: '{format} wird exportiert...',
    it: 'Esportazione di {format}...'
  },
  '{count} cenas': {
    'en-US': '{count} scenes',
    es: '{count} escenas',
    fr: '{count} scènes',
    de: '{count} Szenen',
    it: '{count} scene'
  },
  'Aba {number}': {
    'en-US': 'Sheet {number}',
    es: 'Hoja {number}',
    fr: 'Feuille {number}',
    de: 'Blatt {number}',
    it: 'Foglio {number}'
  },
  'Fontes para {tool}': {
    'en-US': 'Sources for {tool}',
    es: 'Fuentes para {tool}',
    fr: 'Sources pour {tool}',
    de: 'Quellen für {tool}',
    it: 'Fonti per {tool}'
  },
  'Configurar {tool}': {
    'en-US': 'Configure {tool}',
    es: 'Configurar {tool}',
    fr: 'Configurer {tool}',
    de: '{tool} konfigurieren',
    it: 'Configura {tool}'
  },
  'Projeto não encontrado': {
    'en-US': 'Project not found',
    es: 'Proyecto no encontrado',
    fr: 'Projet introuvable',
    de: 'Projekt nicht gefunden',
    it: 'Progetto non trovato'
  },
  'Projeto não encontrado.': {
    'en-US': 'Project not found.',
    es: 'Proyecto no encontrado.',
    fr: 'Projet introuvable.',
    de: 'Projekt nicht gefunden.',
    it: 'Progetto non trovato.'
  },
  'Fonte não encontrada': {
    'en-US': 'Source not found',
    es: 'Fuente no encontrada',
    fr: 'Source introuvable',
    de: 'Quelle nicht gefunden',
    it: 'Fonte non trovata'
  },
  'Artefato não encontrado': {
    'en-US': 'Artifact not found',
    es: 'Artefacto no encontrado',
    fr: 'Artefact introuvable',
    de: 'Artefakt nicht gefunden',
    it: 'Artefatto non trovato'
  },
  'Artefato não encontrado.': {
    'en-US': 'Artifact not found.',
    es: 'Artefacto no encontrado.',
    fr: 'Artefact introuvable.',
    de: 'Artefakt nicht gefunden.',
    it: 'Artefatto non trovato.'
  },
  'Ação desconhecida: {action}': {
    'en-US': 'Unknown action: {action}',
    es: 'Acción desconocida: {action}',
    fr: 'Action inconnue : {action}',
    de: 'Unbekannte Aktion: {action}',
    it: 'Azione sconosciuta: {action}'
  },
  'Formato {format} não disponível para este artefato. Disponíveis: {formats}': {
    'en-US': 'Format {format} is not available for this artifact. Available: {formats}',
    es: 'El formato {format} no está disponible para este artefacto. Disponibles: {formats}',
    fr: 'Le format {format} n’est pas disponible pour cet artefact. Disponibles : {formats}',
    de: 'Format {format} ist für dieses Artefakt nicht verfügbar. Verfügbar: {formats}',
    it: 'Il formato {format} non è disponibile per questo artefatto. Disponibili: {formats}'
  },
  'Adicione ao menos uma fonte ou preencha as instruções antes de gerar.': {
    'en-US': 'Add at least one source or fill in the instructions before generating.',
    es: 'Añade al menos una fuente o completa las instrucciones antes de generar.',
    fr: 'Ajoutez au moins une source ou remplissez les instructions avant de générer.',
    de: 'Fügen Sie mindestens eine Quelle hinzu oder füllen Sie die Anweisungen aus, bevor Sie generieren.',
    it: 'Aggiungi almeno una fonte o compila le istruzioni prima di generare.'
  },
  'Versão {version} não encontrada.': {
    'en-US': 'Version {version} not found.',
    es: 'Versión {version} no encontrada.',
    fr: 'Version {version} introuvable.',
    de: 'Version {version} nicht gefunden.',
    it: 'Versione {version} non trovata.'
  },
  'Informe uma instrução de refino.': {
    'en-US': 'Enter a refinement instruction.',
    es: 'Indica una instrucción de refinamiento.',
    fr: 'Saisissez une instruction d’affinage.',
    de: 'Geben Sie eine Verfeinerungsanweisung ein.',
    it: 'Inserisci un’istruzione di rifinitura.'
  },
  'Pacote .momai-docs inválido.': {
    'en-US': 'Invalid .momai-docs package.',
    es: 'Paquete .momai-docs no válido.',
    fr: 'Paquet .momai-docs invalide.',
    de: 'Ungültiges .momai-docs-Paket.',
    it: 'Pacchetto .momai-docs non valido.'
  },
  'URL inválida ou endereço privado/local bloqueado por segurança.': {
    'en-US': 'Invalid URL or private/local address blocked for security.',
    es: 'URL no válida o dirección privada/local bloqueada por seguridad.',
    fr: 'URL invalide ou adresse privée/locale bloquée pour des raisons de sécurité.',
    de: 'Ungültige URL oder private/lokale Adresse aus Sicherheitsgründen blockiert.',
    it: 'URL non valido o indirizzo privato/locale bloccato per sicurezza.'
  },
  'URL do YouTube inválida.': {
    'en-US': 'Invalid YouTube URL.',
    es: 'URL de YouTube no válida.',
    fr: 'URL YouTube invalide.',
    de: 'Ungültige YouTube-URL.',
    it: 'URL di YouTube non valido.'
  },
  'Transcrição de áudio/vídeo indisponível no momento (sidecar de voz inativo).': {
    'en-US': 'Audio/video transcription is unavailable right now (voice sidecar inactive).',
    es: 'La transcripción de audio/vídeo no está disponible ahora (sidecar de voz inactivo).',
    fr: 'La transcription audio/vidéo est indisponible pour le moment (sidecar vocal inactif).',
    de: 'Audio-/Video-Transkription ist derzeit nicht verfügbar (Voice-Sidecar inaktiv).',
    it: 'La trascrizione audio/video non è disponibile al momento (sidecar vocale inattivo).'
  },
  'Arquivo DOCX inválido: word/document.xml não encontrado.': {
    'en-US': 'Invalid DOCX file: word/document.xml not found.',
    es: 'Archivo DOCX no válido: no se encontró word/document.xml.',
    fr: 'Fichier DOCX invalide : word/document.xml introuvable.',
    de: 'Ungültige DOCX-Datei: word/document.xml nicht gefunden.',
    it: 'File DOCX non valido: word/document.xml non trovato.'
  },
  'Brasão / Logo': {
    'en-US': 'Coat of Arms / Logo',
    es: 'Escudo / Logotipo',
    fr: 'Armoiries / Logo',
    de: 'Wappen / Logo',
    it: 'Stemma / Logo'
  },
  'Buscar brasão ou logo (ex.: Brasão de Curitiba)': {
    'en-US': 'Search coat of arms or logo (e.g. City of Curitiba)',
    es: 'Buscar escudo o logotipo (ej.: Escudo de Curitiba)',
    fr: 'Rechercher un blason ou logo (ex. : Armoiries de Curitiba)',
    de: 'Wappen oder Logo suchen (z. B. Wappen von Curitiba)',
    it: 'Cerca stemma o logo (es.: Stemma di Curitiba)'
  },
  'Aplicar em:': {
    'en-US': 'Apply to:',
    es: 'Aplicar en:',
    fr: 'Appliquer à :',
    de: 'Anwenden auf:',
    it: 'Applica a:'
  },
  'Redefinir zoom': {
    'en-US': 'Reset zoom',
    es: 'Restablecer zoom',
    fr: 'Réinitialiser le zoom',
    de: 'Zoom zurücksetzen',
    it: 'Ripristina zoom'
  },
  'Buscar modelos...': {
    'en-US': 'Search templates...',
    es: 'Buscar plantillas...',
    fr: 'Rechercher des modèles...',
    de: 'Vorlagen suchen...',
    it: 'Cerca modelli...'
  },
  'Nenhum modelo encontrado para essa busca.': {
    'en-US': 'No templates found for this search.',
    es: 'No se encontraron plantillas para esta búsqueda.',
    fr: 'Aucun modèle trouvé pour cette recherche.',
    de: 'Keine Vorlagen für diese Suche gefunden.',
    it: 'Nessun modello trovato per questa ricerca.'
  },
  'SUMÁRIO': {
    'en-US': 'TABLE OF CONTENTS',
    es: 'ÍNDICE',
    fr: 'SOMMAIRE',
    de: 'INHALTSVERZEICHNIS',
    it: 'SOMMARIO'
  },
  'Sumário': {
    'en-US': 'Table of Contents',
    es: 'Índice',
    fr: 'Sommaire',
    de: 'Inhaltsverzeichnis',
    it: 'Sommario'
  },
  'CONCLUSÃO': {
    'en-US': 'CONCLUSION',
    es: 'CONCLUSIÓN',
    fr: 'CONCLUSION',
    de: 'FAZIT',
    it: 'CONCLUSIONE'
  },
  'Conclusão': {
    'en-US': 'Conclusion',
    es: 'Conclusión',
    fr: 'Conclusion',
    de: 'Fazit',
    it: 'Conclusione'
  },
  'Exemplo:': {
    'en-US': 'Example:',
    es: 'Ejemplo:',
    fr: 'Exemple :',
    de: 'Beispiel:',
    it: 'Esempio:'
  },
  'Considerações Finais': {
    'en-US': 'Final Considerations',
    es: 'Consideraciones Finales',
    fr: 'Considérations finales',
    de: 'Schlussbetrachtungen',
    it: 'Considerazioni finali'
  },
  'Próximos Passos': {
    'en-US': 'Next Steps',
    es: 'Próximos Pasos',
    fr: 'Prochaines étapes',
    de: 'Nächste Schritte',
    it: 'Prossimi passi'
  },
  'Pág. {current}/{total}': {
    'en-US': 'Page {current}/{total}',
    es: 'Pág. {current}/{total}',
    fr: 'Page {current}/{total}',
    de: 'Seite {current}/{total}',
    it: 'Pag. {current}/{total}'
  },
  'Abrir PDF': {
    'en-US': 'Open PDF',
    es: 'Abrir PDF',
    fr: 'Ouvrir le PDF',
    de: 'PDF öffnen',
    it: 'Apri PDF'
  },
  'MÓDULO': {
    'en-US': 'MODULE',
    es: 'MÓDULO',
    fr: 'MODULE',
    de: 'MODUL',
    it: 'MODULO'
  },
  'Pág.': {
    'en-US': 'Page',
    es: 'Pág.',
    fr: 'Page',
    de: 'Seite',
    it: 'Pag.'
  },
  'Identificação do Estudante': {
    'en-US': 'Student Identification',
    es: 'Identificación del Estudiante',
    fr: 'Identification de l’étudiant',
    de: 'Teilnehmerdaten',
    it: 'Identificazione dello Studente'
  },
  'Expandindo módulos da apostila para cobertura completa...': {
    'en-US': 'Expanding workbook modules for complete coverage...',
    es: 'Ampliando módulos del cuaderno para una cobertura completa...',
    fr: 'Extension des modules du livret pour une couverture complète...',
    de: 'Erweitere Lernmodule für vollständige Abdeckung...',
    it: 'Espansione dei moduli della dispensa per una copertura completa...'
  },
  'Revisando qualidade editorial e profundidade do material...': {
    'en-US': 'Reviewing editorial quality and content depth...',
    es: 'Revisando la calidad editorial y la profundidad del material...',
    fr: 'Révision de la qualité éditoriale et de la profondeur du contenu...',
    de: 'Überprüfe redaktionelle Qualität und Inhaltstiefe...',
    it: 'Revisione della qualità editoriale e della profondità del materiale...'
  },
  'Redigindo módulo {current}/{total}...': {
    'en-US': 'Drafting module {current}/{total}...',
    es: 'Redactando módulo {current}/{total}...',
    fr: 'Rédaction du module {current}/{total}...',
    de: 'Erstelle Modul {current}/{total}...',
    it: 'Stesura del modulo {current}/{total}...'
  },
  'Finalizando capa, glossário e referências...': {
    'en-US': 'Finalizing cover, glossary, and references...',
    es: 'Finalizando portada, glosario y referencias...',
    fr: 'Finalisation de la couverture, du glossaire et des références...',
    de: 'Stelle Deckblatt, Glossar und Quellen fertig...',
    it: 'Finalizzazione di copertina, glossario e riferimenti...'
  },
  'Nesta edição': {
    'en-US': 'In this edition',
    es: 'En esta edición',
    fr: 'Dans cette édition',
    de: 'In dieser Ausgabe',
    it: 'In questa edizione'
  },
  'Gabarito Comentado': {
    'en-US': 'Answer Key & Explanations',
    es: 'Solucionario Comentado',
    fr: 'Corrigé commenté',
    de: 'Lösungen und Erläuterungen',
    it: 'Soluzioni Commentate'
  },
  'Tabela': {
    'en-US': 'Table',
    es: 'Tabla',
    fr: 'Tableau',
    de: 'Tabelle',
    it: 'Tabella'
  },
  'Figura': {
    'en-US': 'Figure',
    es: 'Figura',
    fr: 'Figure',
    de: 'Abbildung',
    it: 'Figura'
  },
  'Clique para enviar um documento Word/PDF ou configurar seu timbre': {
    'en-US': 'Click to upload a Word/PDF document or configure your letterhead',
    es: 'Haz clic para subir un documento Word/PDF o configurar tu membrete',
    fr: 'Cliquez pour importer un document Word/PDF ou configurer votre en-tête',
    de: 'Klicken Sie, um ein Word-/PDF-Dokument hochzuladen oder Ihren Briefkopf einzurichten',
    it: 'Fai clic per caricare un documento Word/PDF o configurare la tua carta intestata'
  },
  'Enviar Word ou PDF': {
    'en-US': 'Upload Word or PDF',
    es: 'Subir Word o PDF',
    fr: 'Importer Word ou PDF',
    de: 'Word oder PDF hochladen',
    it: 'Carica Word o PDF'
  },
  'Enviar documento Word ou PDF': {
    'en-US': 'Upload Word or PDF document',
    es: 'Subir documento Word o PDF',
    fr: 'Importer un document Word ou PDF',
    de: 'Word- oder PDF-Dokument hochladen',
    it: 'Carica documento Word o PDF'
  },
  'Envie um documento Word ou PDF para preencher seu timbre automaticamente, ou ajuste os dados abaixo.': {
    'en-US': 'Upload a Word or PDF document to fill in your letterhead automatically, or adjust the details below.',
    es: 'Sube un documento Word o PDF para completar tu membrete automáticamente, o ajusta los datos abajo.',
    fr: 'Importez un document Word ou PDF pour remplir votre en-tête automatiquement, ou ajustez les informations ci-dessous.',
    de: 'Laden Sie ein Word- oder PDF-Dokument hoch, um Ihren Briefkopf automatisch auszufüllen, oder passen Sie die Daten unten an.',
    it: 'Carica un documento Word o PDF per compilare automaticamente la tua carta intestata, oppure modifica i dati qui sotto.'
  },
  'Lendo documento e extraindo timbre...': {
    'en-US': 'Reading document and extracting letterhead...',
    es: 'Leyendo documento y extrayendo membrete...',
    fr: 'Lecture du document et extraction de l’en-tête...',
    de: 'Dokument wird gelesen und Briefkopf extrahiert...',
    it: 'Lettura del documento ed estrazione della carta intestata...'
  },
  'Arraste seu documento Word ou PDF aqui': {
    'en-US': 'Drag your Word or PDF document here',
    es: 'Arrastra tu documento Word o PDF aquí',
    fr: 'Glissez votre document Word ou PDF ici',
    de: 'Ziehen Sie Ihr Word- oder PDF-Dokument hierher',
    it: 'Trascina qui il tuo documento Word o PDF'
  },
  'ou clique para escolher um arquivo (.docx, .pdf, .png, .jpg)': {
    'en-US': 'or click to choose a file (.docx, .pdf, .png, .jpg)',
    es: 'o haz clic para elegir un archivo (.docx, .pdf, .png, .jpg)',
    fr: 'ou cliquez pour choisir un fichier (.docx, .pdf, .png, .jpg)',
    de: 'oder klicken Sie, um eine Datei auszuwählen (.docx, .pdf, .png, .jpg)',
    it: 'oppure fai clic per scegliere un file (.docx, .pdf, .png, .jpg)'
  },
  'Baseado em: {name}': {
    'en-US': 'Based on: {name}',
    es: 'Basado en: {name}',
    fr: 'Basé sur : {name}',
    de: 'Basierend auf: {name}',
    it: 'Basato su: {name}'
  },
  '{count} campo(s) detectado(s) para preenchimento automático.': {
    'en-US': '{count} field(s) detected for automatic filling.',
    es: '{count} campo(s) detectado(s) para rellenado automático.',
    fr: '{count} champ(s) détecté(s) pour le remplissage automatique.',
    de: '{count} Feld(er) zum automatischen Ausfüllen erkannt.',
    it: '{count} campo/i rilevato/i per la compilazione automatica.'
  },
  'O layout e as informações do arquivo serão usados como base nos seus documentos.': {
    'en-US': 'The file layout and details will be used as the base for your documents.',
    es: 'El diseño y los datos del archivo se usarán como base en tus documentos.',
    fr: 'La mise en page et les informations du fichier serviront de base pour vos documents.',
    de: 'Layout und Daten der Datei werden als Grundlage für Ihre Dokumente verwendet.',
    it: 'Il layout e le informazioni del file verranno usati come base per i tuoi documenti.'
  },
  'Remover arquivo': {
    'en-US': 'Remove file',
    es: 'Eliminar archivo',
    fr: 'Supprimer le fichier',
    de: 'Datei entfernen',
    it: 'Rimuovi file'
  },
  'Nome da instituição ou empresa': {
    'en-US': 'Institution or company name',
    es: 'Nombre de la institución o empresa',
    fr: 'Nom de l’institution ou de l’entreprise',
    de: 'Name der Institution oder Firma',
    it: 'Nome dell’istituzione o azienda'
  },
  'Ex: Prefeitura Municipal, Escritório Silva & Associados': {
    'en-US': 'e.g., City Hall, Silva & Associates',
    es: 'Ej.: Ayuntamiento, Estudio Silva & Asociados',
    fr: 'Ex. : Mairie, Cabinet Silva & Associés',
    de: 'z. B. Stadtverwaltung, Kanzlei Silva & Partner',
    it: 'Es.: Comune, Studio Silva & Associati'
  },
  'Texto do cabeçalho': {
    'en-US': 'Header text',
    es: 'Texto del encabezado',
    fr: 'Texte d’en-tête',
    de: 'Kopfzeilentext',
    it: 'Testo dell’intestazione'
  },
  'Aparece no topo da página (opcional)': {
    'en-US': 'Appears at the top of the page (optional)',
    es: 'Aparece en la parte superior de la página (opcional)',
    fr: 'Apparaît en haut de la page (facultatif)',
    de: 'Erscheint oben auf der Seite (optional)',
    it: 'Appare in cima alla pagina (opzionale)'
  },
  'Texto do rodapé': {
    'en-US': 'Footer text',
    es: 'Texto del pie de página',
    fr: 'Texte de pied de page',
    de: 'Fußzeilentext',
    it: 'Testo del piè di pagina'
  },
  'Ex: Endereço, telefone ou site (opcional)': {
    'en-US': 'e.g., Address, phone or website (optional)',
    es: 'Ej.: Dirección, teléfono o sitio web (opcional)',
    fr: 'Ex. : Adresse, téléphone ou site web (facultatif)',
    de: 'z. B. Adresse, Telefon oder Website (optional)',
    it: 'Es.: Indirizzo, telefono o sito web (opzionale)'
  },
  'Nome na assinatura': {
    'en-US': 'Signature name',
    es: 'Nombre en la firma',
    fr: 'Nom de signature',
    de: 'Name in der Unterschrift',
    it: 'Nome nella firma'
  },
  'Cargo ou função': {
    'en-US': 'Role or title',
    es: 'Cargo o función',
    fr: 'Poste ou fonction',
    de: 'Rolle oder Funktion',
    it: 'Ruolo o carica'
  },
  'Opcional': {
    'en-US': 'Optional',
    es: 'Opcional',
    fr: 'Facultatif',
    de: 'Optional',
    it: 'Opzionale'
  },
  'Cor principal': {
    'en-US': 'Primary color',
    es: 'Color principal',
    fr: 'Couleur principale',
    de: 'Hauptfarbe',
    it: 'Colore principale'
  },
  'Cor de destaque': {
    'en-US': 'Accent color',
    es: 'Color de acento',
    fr: 'Couleur d’accent',
    de: 'Akzentfarbe',
    it: 'Colore di accento'
  },
  'Logo ou brasão': {
    'en-US': 'Logo or emblem',
    es: 'Logo o escudo',
    fr: 'Logo ou blason',
    de: 'Logo oder Wappen',
    it: 'Logo o stemma'
  },
  'Logo ou brasão carregado': {
    'en-US': 'Logo or emblem loaded',
    es: 'Logo o escudo cargado',
    fr: 'Logo ou blason chargé',
    de: 'Logo oder Wappen geladen',
    it: 'Logo o stemma caricato'
  },
  'Nenhum logo adicionado': {
    'en-US': 'No logo added',
    es: 'Ningún logo agregado',
    fr: 'Aucun logo ajouté',
    de: 'Kein Logo hinzugefügt',
    it: 'Nessun logo aggiunto'
  },
  'Trocar': {
    'en-US': 'Change',
    es: 'Cambiar',
    fr: 'Changer',
    de: 'Ändern',
    it: 'Cambia'
  },
  'Enviar logo': {
    'en-US': 'Upload logo',
    es: 'Subir logo',
    fr: 'Importer un logo',
    de: 'Logo hochladen',
    it: 'Carica logo'
  },
  'Salvar e usar timbre': {
    'en-US': 'Save & use letterhead',
    es: 'Guardar y usar membrete',
    fr: 'Enregistrer et utiliser',
    de: 'Speichern & verwenden',
    it: 'Salva e usa'
  },
  'Salvar timbre': {
    'en-US': 'Save letterhead',
    es: 'Guardar membrete',
    fr: 'Enregistrer l’en-tête',
    de: 'Briefkopf speichern',
    it: 'Salva carta intestata'
  },
  'Usar meu documento': {
    'en-US': 'Use my document',
    es: 'Usar mi documento',
    fr: 'Utiliser mon document',
    de: 'Eigenes Dokument verwenden',
    it: 'Usa il mio documento'
  },
  'Meu documento': {
    'en-US': 'My document',
    es: 'Mi documento',
    fr: 'Mon document',
    de: 'Mein Dokument',
    it: 'Il mio documento'
  },
  'Enviar documento Word ou PDF para usar como base': {
    'en-US': 'Upload a Word or PDF document to use as a base',
    es: 'Sube un documento Word o PDF para usar como base',
    fr: 'Importer un document Word ou PDF comme base',
    de: 'Word- oder PDF-Dokument als Vorlage hochladen',
    it: 'Carica un documento Word o PDF da usare come base'
  },
  'Envie um arquivo Word ou PDF para preencher ou usar como base nos seus documentos.': {
    'en-US': 'Upload a Word or PDF file to fill in or use as the base for your documents.',
    es: 'Sube un archivo Word o PDF para rellenar o usar como base en tus documentos.',
    fr: 'Importez un fichier Word ou PDF à remplir ou à utiliser comme base pour vos documents.',
    de: 'Laden Sie eine Word- oder PDF-Datei hoch, um sie auszufüllen oder als Vorlage für Ihre Dokumente zu verwenden.',
    it: 'Carica un file Word o PDF da compilare o usare come base per i tuoi documenti.'
  },
  'Lendo documento...': {
    'en-US': 'Reading document...',
    es: 'Leyendo documento...',
    fr: 'Lecture du document...',
    de: 'Dokument wird gelesen...',
    it: 'Lettura del documento...'
  },
  'ou clique para escolher um arquivo (.docx, .pdf)': {
    'en-US': 'or click to choose a file (.docx, .pdf)',
    es: 'o haz clic para elegir un archivo (.docx, .pdf)',
    fr: 'ou cliquez pour choisir un fichier (.docx, .pdf)',
    de: 'oder klicken Sie, um eine Datei auszuwählen (.docx, .pdf)',
    it: 'oppure fai clic per scegliere un file (.docx, .pdf)'
  },
  'Documento carregado: {name}': {
    'en-US': 'Document loaded: {name}',
    es: 'Documento cargado: {name}',
    fr: 'Document chargé : {name}',
    de: 'Dokument geladen: {name}',
    it: 'Documento caricato: {name}'
  },
  'Usar este documento': {
    'en-US': 'Use this document',
    es: 'Usar este documento',
    fr: 'Utiliser ce document',
    de: 'Dieses Dokument verwenden',
    it: 'Usa questo documento'
  },
  'Personalizado': {
    'en-US': 'Custom',
    es: 'Personalizado',
    fr: 'Personnalisé',
    de: 'Benutzerdefiniert',
    it: 'Personalizzato'
  },
  'Qtd.': {
    'en-US': 'Qty',
    es: 'Cant.',
    fr: 'Qté',
    de: 'Anz.',
    it: 'Qtà'
  },
  'páginas': {
    'en-US': 'pages',
    es: 'páginas',
    fr: 'pages',
    de: 'Seiten',
    it: 'pagine'
  },
  'minutos': {
    'en-US': 'minutes',
    es: 'minutos',
    fr: 'minutes',
    de: 'Minuten',
    it: 'minuti'
  },
  'slides': {
    'en-US': 'slides',
    es: 'diapositivas',
    fr: 'diapositives',
    de: 'Folien',
    it: 'diapositive'
  },
  'abas': {
    'en-US': 'tabs',
    es: 'pestañas',
    fr: 'onglets',
    de: 'Registerkarten',
    it: 'schede'
  },
  'cartões': {
    'en-US': 'cards',
    es: 'tarjetas',
    fr: 'cartes',
    de: 'Karten',
    it: 'carte'
  },
  'nós': {
    'en-US': 'nodes',
    es: 'nodos',
    fr: 'nœuds',
    de: 'Knoten',
    it: 'nodi'
  },
  'Voz': {
    'en-US': 'Voice',
    es: 'Voz',
    fr: 'Voix',
    de: 'Stimme',
    it: 'Voce'
  },
  'Voz 1': {
    'en-US': 'Voice 1',
    es: 'Voz 1',
    fr: 'Voix 1',
    de: 'Stimme 1',
    it: 'Voce 1'
  },
  'Voz 2': {
    'en-US': 'Voice 2',
    es: 'Voz 2',
    fr: 'Voix 2',
    de: 'Stimme 2',
    it: 'Voce 2'
  },
  'Automática (Feminina)': {
    'en-US': 'Automatic (Female)',
    es: 'Automática (Femenina)',
    fr: 'Automatique (Féminine)',
    de: 'Automatisch (Weiblich)',
    it: 'Automatica (Femminile)'
  },
  'Automática (Masculina)': {
    'en-US': 'Automatic (Male)',
    es: 'Automática (Masculina)',
    fr: 'Automatique (Masculine)',
    de: 'Automatisch (Männlich)',
    it: 'Automatica (Maschile)'
  },
  'Texto': {
    'en-US': 'Text',
    es: 'Texto',
    fr: 'Texte',
    de: 'Text',
    it: 'Testo'
  },
  'Carregando áudio do podcast...': {
    'en-US': 'Loading podcast audio...',
    es: 'Cargando audio del podcast...',
    fr: 'Chargement de l’audio du podcast...',
    de: 'Podcast-Audio wird geladen...',
    it: 'Caricamento audio del podcast...'
  },
  'Não foi possível carregar o áudio do podcast.': {
    'en-US': 'Could not load podcast audio.',
    es: 'No se pudo cargar el audio del podcast.',
    fr: 'Impossible de charger l’audio du podcast.',
    de: 'Podcast-Audio konnte nicht geladen werden.',
    it: 'Impossibile caricare l’audio del podcast.'
  },
  'Abrir XLSX': {
    'en-US': 'Open XLSX',
    es: 'Abrir XLSX',
    fr: 'Ouvrir XLSX',
    de: 'XLSX öffnen',
    it: 'Apri XLSX'
  },
  'Abrir PNG': {
    'en-US': 'Open PNG',
    es: 'Abrir PNG',
    fr: 'Ouvrir PNG',
    de: 'PNG öffnen',
    it: 'Apri PNG'
  },
  'Carregando projeto...': {
    'en-US': 'Loading project...',
    es: 'Cargando proyecto...',
    fr: 'Chargement du projet...',
    de: 'Projekt wird geladen...',
    it: 'Caricamento progetto...'
  },
  'Resultado final': {
    'en-US': 'Final result',
    es: 'Resultado final',
    fr: 'Résultat final',
    de: 'Endergebnis',
    it: 'Risultato finale'
  },
  'Refazer quiz': {
    'en-US': 'Retake quiz',
    es: 'Repetir quiz',
    fr: 'Refaire le quiz',
    de: 'Quiz wiederholen',
    it: 'Ripeti quiz'
  },
  'Nota final': {
    'en-US': 'Final score',
    es: 'Nota final',
    fr: 'Note finale',
    de: 'Endnote',
    it: 'Voto finale'
  },
  'Aproveitamento': {
    'en-US': 'Accuracy',
    es: 'Aprovechamiento',
    fr: 'Réussite',
    de: 'Erfolgsquote',
    it: 'Punteggio'
  },
  'Acertos': {
    'en-US': 'Correct',
    es: 'Aciertos',
    fr: 'Bonnes réponses',
    de: 'Richtig',
    it: 'Risposte esatte'
  },
  'Resumo das questões': {
    'en-US': 'Question summary',
    es: 'Resumen de preguntas',
    fr: 'Résumé des questions',
    de: 'Fragenübersicht',
    it: 'Riepilogo domande'
  },
  'Não respondida': {
    'en-US': 'Unanswered',
    es: 'Sin responder',
    fr: 'Sans réponse',
    de: 'Unbeantwortet',
    it: 'Non risposta'
  },
  'Acertou': {
    'en-US': 'Correct',
    es: 'Correcta',
    fr: 'Correct',
    de: 'Richtig',
    it: 'Corretta'
  },
  'Errou': {
    'en-US': 'Incorrect',
    es: 'Incorrecta',
    fr: 'Incorrect',
    de: 'Falsch',
    it: 'Errata'
  },
  'Mostrar resposta': {
    'en-US': 'Show answer',
    es: 'Mostrar respuesta',
    fr: 'Afficher la réponse',
    de: 'Antwort zeigen',
    it: 'Mostra risposta'
  },
  'Você acertou!': {
    'en-US': 'You got it right!',
    es: '¡Acertaste!',
    fr: 'Bonne réponse !',
    de: 'Richtig beantwortet!',
    it: 'Risposta esatta!'
  },
  'Resposta incorreta': {
    'en-US': 'Incorrect answer',
    es: 'Respuesta incorrecta',
    fr: 'Réponse incorrecte',
    de: 'Falsche Antwort',
    it: 'Risposta errata'
  },
  'Próxima questão': {
    'en-US': 'Next question',
    es: 'Siguiente pregunta',
    fr: 'Question suivante',
    de: 'Nächste Frage',
    it: 'Prossima domanda'
  },
  'Ver nota final': {
    'en-US': 'See final score',
    es: 'Ver nota final',
    fr: 'Voir la note finale',
    de: 'Endnote ansehen',
    it: 'Vedi voto finale'
  },
  'Explicação': {
    'en-US': 'Explanation',
    es: 'Explicación',
    fr: 'Explication',
    de: 'Erklärung',
    it: 'Spiegazione'
  }
}
