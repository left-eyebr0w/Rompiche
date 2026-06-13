# Traçage audio — la boîte noire du diorama

Outil de **débogage / logging**, pas d'enregistrement audio. Il capture la
chaîne causale exhaustive de chaque son — de la goutte qui tombe jusqu'à son
rendu sur les 6 points d'écoute — dans un fichier rejouable hors-ligne.

## Utilisation

1. Lance l'écoute (bouton Play) pour que le moteur audio s'initialise.
2. **Ctrl+Alt+D** ouvre le panneau Debug ; **Ctrl+Alt+R** démarre/arrête
   l'enregistrement (un bouton **● Rec / ■ Stop** est aussi dans le panneau).
3. Arrête, puis **⤓ Export** télécharge un fichier `rompiche-trace-*.ndjson`.

Ce fichier est l'artefact à partager pour déboguer : texte brut, une ligne JSON
par événement, lisible et `grep`-able.

## Format

NDJSON (un objet JSON par ligne). La première ligne est un en-tête :

```json
{"seq":0,"type":"header","format":"rompiche-trace/1","meta":{…},"count":1234,"truncated":false}
```

`truncated: true` signale que l'anneau (200 000 événements par défaut) a tourné
et que le début de session est perdu — augmenter `capacity` pour des sessions
plus longues.

### Champs communs à tout événement

| Champ  | Sens |
|--------|------|
| `seq`  | numéro de séquence monotone (ordre d'émission) |
| `t`    | ms depuis le début (horloge `performance.now`, frames/React) |
| `at`   | s depuis le début (horloge `AudioContext.currentTime`, rendu audio) |
| `sv`   | version d'état du monde en vigueur (cf. `state`) |
| `type` | type d'événement (ci-dessous) |

Les **deux horloges** servent à déboguer les décalages entre la physique
(visuel) et le son.

### Types d'événements

| `type`    | Émis quand | Champs clés |
|-----------|------------|-------------|
| `session` | démarrage/arrêt | `event: start\|stop` |
| `state`   | un paramètre du monde change | `patch` (uniquement les champs modifiés) |
| `impact`  | une goutte franchit le sol (**cause racine**) | `impact`, `surface`, `x`, `z` |
| `reject`  | un impact ne produit PAS de son | `impact`, `surface`, `reason`, `cell?` |
| `trigger` | un grain est déclenché | `impact`, `grain`, `surface`, `x/y/z`, `gainDb`, `detune`, `sample`, `dur`, `minDist`, `maxDist` |
| `acquire` | une voix est affectée au grain | `grain`, `impact`, `voice`, `mat`, `stolen` |
| `steal`   | une voix est volée (pool plein) | `grain`, `victim:{voice,grain,impact,age}`, `fade` |
| `release` | un grain finit naturellement | `grain`, `impact`, `voice`, `reason:ended` |
| `env`     | échantillon d'enveloppe (~30 Hz, par voix active) | `grain`, `impact`, `voice`, `mat`, `db`, `x/y/z` |
| `faces`   | échantillon des 6 pistes (~30 Hz) | `labels`, `db[6]`, `head`, `busy` |

`reason` des `reject` : `not-ready`, `suspended`, `no-bank`, `no-material`,
`cooldown` (anti-mitraillage par cellule de 0,5 m).

### Les 6 pistes

L'événement `faces` porte un tableau `db` de 6 niveaux (en dB, `null` =
silence), un par point d'écoute directionnel : `FRONT, BACK, DROIT, GAUCH,
HAUT, BAS` (cf. `labels`). C'est la projection de toutes les voix actives sur
les normales des 6 faces de la tête (produit scalaire pondéré par le niveau),
échantillonnée dans le temps : la session se relit comme 6 timelines
parallèles. Les contributions par face sont aussi reconstituables à partir des
`env` (position de chaque voix) et de la position auditeur (deltas `state`).

## Reconstruire une chaîne causale

Tout est chaîné par deux identifiants :

- **`impact`** relie l'impact racine → sa décision (`trigger`/`reject`) → la
  voix (`acquire`/`steal`) → toute son enveloppe (`env`) → sa fin (`release`).
- **`grain`** identifie un grain précis (utile quand une voix est réutilisée).

Exemples (`jq`) :

```sh
# Toute la vie du grain 42, dans l'ordre
grep -F '"grain":42' trace.ndjson

# Pourquoi des impacts n'ont pas sonné, par raison
jq -r 'select(.type=="reject").reason' trace.ndjson | sort | uniq -c

# Les 6 pistes au fil du temps (t, FRONT, …, BAS)
jq -r 'select(.type=="faces") | [.t]+.db | @tsv' trace.ndjson
```

## Relecture déterministe

Le seul aléa d'un grain est le **choix du sample** (`sample`, index dans la
banque du matériau) et le **detune**, tous deux journalisés dans `trigger`.
Combinés à la position et au gain, ils suffisent à re-déclencher exactement les
mêmes grains : on peut **ré-entendre** une session sans avoir jamais enregistré
d'audio. (Le moteur de relecture n'est pas encore branché ; la trace en porte
déjà toute l'information.)
