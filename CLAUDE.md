# Conventions du projet

## Commentaires

Pas de commentaires intempestifs dans le code. On préfère des noms de variables,
de fonctions et de types explicites (en français, comme le reste du code) qui rendent
le commentaire inutile. Si une intention n'est pas évidente, on extrait une fonction
ou une constante bien nommée plutôt que d'ajouter un commentaire.

## Interface

Pas de bibliothèque d'interface externe (ni DSFR, ni kit de composants) : elles sont
trop lourdes pour l'extension. Quand on veut un composant du DSFR, on imite ses styles
à la main dans le CSS de la page, avec les couleurs et les dimensions officielles.
