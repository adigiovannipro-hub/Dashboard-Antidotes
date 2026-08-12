# Programmation — pas de prompt

La programmation n'appelle pas l'API Anthropic : c'est une action déterministe
qui pousse les posts validés vers les APIs des plateformes.

Le job technique vit dans `src/lib/scheduling/publish.ts`. Aujourd'hui c'est un
stub qui journalise les posts qui seraient programmés, avec une interface prête
pour brancher l'API Meta plus tard — aucun appel réel n'est fait.

Ce fichier existe pour que les quatre phases aient chacune leur entrée dans ce
dossier, et pour documenter ce choix au même endroit que les prompts.
