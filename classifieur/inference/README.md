# Inférence

`prediction.ts` fournit un essai local d'URL avec les poids créés par la chaîne d'entraînement. Il réutilise les caractéristiques et la normalisation de Train, ainsi que le seuil du rapport d'évaluation. Les commandes sont décrites dans le [README du classifieur](../README.md).

L'extension embarque un modèle d'essai exporté par `classifieur/exportation/`. Ses caractéristiques et sa normalisation sont partagées dans `src/noyau/modele/`. La fenêtre de comparaison montre les résultats du modèle et des règles sans modifier les alertes.
