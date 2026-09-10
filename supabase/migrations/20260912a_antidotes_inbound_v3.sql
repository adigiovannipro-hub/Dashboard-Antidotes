-- ===========================================================================
-- Pôle « Antidotes », inbound troisième forme
--
-- L'écran se replie sur un seul tableau : plus de vue « Sujets », plus de vue
-- « Consignes », plus de vue « Mes posts ». Deux conséquences en base :
--
--   • une matière donne trois formes et non deux — post LinkedIn, script de
--     reel, script de vidéo YouTube ;
--   • les consignes ne sont plus un texte unique mais **un prompt et un
--     exemple par forme**, écrits depuis la fenêtre « Prompts ».
-- ===========================================================================

/* `add value` tient dans la transaction du runner depuis Postgres 12 tant
   que la valeur n'est pas *utilisée* au même endroit — ce fichier ne s'en
   sert nulle part, il ne fait que la déclarer. */
alter type antidotes_post_format add value if not exists 'youtube_script';

/* Forme : { "<format>": { "prompt": "…", "example": "…" } }.
   `guidelines` reste au-dessus — c'est la voix, valable pour tout ce qui
   s'écrit ; ceci dit comment **une forme** se fabrique. Un format absent de
   l'objet retombe sur le prompt par défaut du code, jamais sur du vide. */
alter table antidotes_inbound_settings
  add column if not exists prompts jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
