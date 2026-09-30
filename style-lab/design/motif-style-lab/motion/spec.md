# Motion spec — chrome

Personality: snappy, exact, calm. Families: `--ease-out` cubic-bezier(0.2, 0, 0, 1) for feedback; `--ease-in-out` for dialogs.

| Transition | Trigger | Duration | Reduced motion |
|---|---|---|---|
| Button press | pointerdown | 90 ms scale 0.97 | none |
| Row hover | hover | 90 ms background | instant |
| Group collapse | click | 150 ms opacity | instant |
| Dialog open/close | E, X, ? | 150 ms opacity + 4-pt rise | opacity only |
| Toast | action result | 150 ms in, 2.4 s hold, 150 ms out | opacity only |
| Mutate flash | M | 240 ms amber flash on changed rows | none |

Canvas motion is content, not chrome: governed by style params, paused by default under reduced motion.
