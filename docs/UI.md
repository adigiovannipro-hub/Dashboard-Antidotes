# UI

L'arbre des écrans. C'est le seul arbre du dépôt : quand une page ou une
section de navigation change, c'est ici que ça se met à jour.

```
Antidotes
├── / ································· Hub — cartes des espaces + outils internes
│                                       (un seul espace et aucun outil : redirection directe)
│
├── /espace/[workspace] ··············· Un espace client, entreprise ou perso
│   │                                   Rail gauche : sections de l'espace, tableaux en sous-entrées
│   ├── /planning ····················· Planning Éditorial (s'ouvre sur le premier tableau)
│   │   ├── /planning/pe-2026 ········· L'année : mois → réseau → publication
│   │   │                               Contrôle de cadence replié en tête
│   │   └── /planning/faq ············· FAQ du client, enrichie par la Modération
│   └── /[dashboard] ·················· Reporting — ROAS en héros, 9 KPI, courbes,
│                                       répartitions, table ad sets (défilante)
│
├── /moderation ······················· Outil interne — 404 pour qui n'y a pas accès
│   ├── /moderation/[client] ·········· Inbox 3 volets : filtres | conversations | fil
│   │                                   Clavier d'abord : J/K, V, R, A, I, ?
│   └── /moderation/[client]/faq ······ FAQ vue côté Modération
│
├── /entreprise ······················· Outil interne « Mon entreprise » — même politique 404
│   └── /entreprise/recus ············· Reçus : connexion Gmail, boîte de rapprochement Airwallex
│
├── /admin/acces ······················ Invitations et rôles — owner uniquement
│
├── /login ···························· Magic link (si ANTIDOTES_REQUIRE_LOGIN=true)
│   ├── /auth/callback ················ Retour du lien
│   └── /auth/erreur ·················· Lien invalide ou expiré
│
└── En-tête, sur toutes les pages ····· Wordmark → hub · sélecteur d'espaces ·
                                        bandeau « Accès public » (mode ouvert) ·
                                        thème clair/sombre · menu du compte
```

## Principes

- **Une seule navigation par geste.** Le rail gauche porte les sections et
  leurs tableaux ; les pages n'ajoutent pas leur propre rangée d'onglets.
- **Le vert est une ponctuation.** Barre d'entrée active, chiffres clés,
  accents — jamais un fond plein large. Le rouge reste au réellement critique.
- **La densité avant le décor.** Cards `#F2F2F2` sans bordure, tuiles de stats
  compactes, mois vides en retrait : l'écran d'un outil quotidien ne se
  parcourt pas à l'ascenseur.
- **Tout tableau large défile dans son cadre**, jamais la page entière en
  horizontal.
- **Ce qui existe se voit.** Un module accessible apparaît dans le hub ; un
  module interne renvoie 404 à qui n'y a pas droit, pas un 403 qui trahirait
  son existence.
