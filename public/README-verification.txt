Ce dossier sert les fichiers de vérification de propriété de domaine.

Les plateformes dont on consomme les API (TikTok, Google) demandent de
prouver qu'un domaine nous appartient avant d'accepter les URL de CGU et de
politique de confidentialité. Deux méthodes existent : un enregistrement DNS,
impossible sur un domaine `*.vercel.app` qui ne nous appartient pas, et un
fichier de signature à la racine — celle qu'on utilise.

Déposer le fichier fourni par la plateforme ici, tel quel, sans le renommer :
il est servi à la racine du site. `src/proxy.ts` exclut les `.txt` du proxy
d'authentification, sans quoi la vérification tomberait le jour où l'accès se
referme — et ces plateformes la rejouent périodiquement.

Ce fichier-ci n'est qu'une note ; il peut être supprimé sans conséquence.
