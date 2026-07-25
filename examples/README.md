# Example meal

`post-workout-meal.png` was generated with the built-in image tool for the production smoke test.

## Generation prompt

```text
Use case: photorealistic-natural
Asset type: example meal photo for a calorie-tracking dashboard
Primary request: a believable smartphone photo of one healthy post-workout meal ready for calorie estimation
Scene/backdrop: dark matte gym cafe table, no people
Subject: grilled chicken breast sliced into strips, steamed jasmine rice, roasted broccoli and carrots, and a small cup of plain yogurt, all clearly visible as distinct meal components
Style/medium: natural photorealistic food photography with ordinary imperfections, not an advertisement
Composition/framing: landscape 4:3, slightly angled overhead smartphone view, entire plate and yogurt cup visible, useful crop at both thumbnail and large panel sizes
Lighting/mood: soft indoor daylight, neutral and appetizing but realistic
Constraints: no text, no labels, no logo, no watermark, no hands, no cutlery covering the food
```

The same `analyzeMealImage()` function used by the agent sent this image through Vercel AI Gateway and stored the returned four-item, 680 kcal estimate in production D1.
