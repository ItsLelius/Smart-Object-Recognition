# Smart Object Recognition

**ICS106 · Laboratory 10** — a browser-based web app that loads two Google Teachable Machine image classifiers (**V1 baseline** and **V2 improved**), classifies images, and measures how reliably each model recognises **PAPER**, **PLASTIC BOTTLE** and **ALUMINUM CAN** under different conditions.

It exists to answer one question: *does the improved model (V2) actually beat the baseline (V1), and where does it still fail?*

![Smart Object Recognition UI](documentation/screenshots/Smart-Object-Detection-UI.png)

**Headline result:** V1 scored **30 / 36 (83.3%)** and V2 scored **33 / 36 (91.7%)** on the same 36 held-out test images. See `documentation/laboratory-report.pdf` for the full analysis.

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [How to use the app](#how-to-use-the-app)
- [Recommended lab workflow](#recommended-lab-workflow)
- [Understanding the results](#understanding-the-results)
- [Exported files](#exported-files)
- [Project structure](#project-structure)
- [Models used](#models-used)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Tech stack](#tech-stack)

---

## Features

| Feature | What it does |
|---|---|
| **Two models at once** | Load V1 and V2 side by side. Every classification runs on both with the identical image. |
| **Image upload** | Drag and drop or browse. PNG, JPEG or WebP, up to 8 MB, with preview. |
| **Full score display** | Predicted class, a confidence bar and percentage for every class, and the highest-scoring class marked. |
| **Model version display** | Header tag and "Active model" field show whether V1 or V2 is in use. |
| **Uncertainty warning** | Flags a result when the top score is below your threshold (default 70%) or the top two classes are within 15 points. |
| **Condition check** | Generates six versions of one image (upright, 90°, 180°, low lighting, complex background, increased distance) and classifies each with every loaded model. |
| **Test log** | Records V1 and V2 results in one row with an Improved / Regressed / Same column. |
| **Accuracy summary** | Live per-condition and overall accuracy for both models. |
| **CSV export** | Export V1 results, V2 results, or a side-by-side comparison. |
| **Webcam recognition** | Live classification from the camera with the active model (demo only). |
| **Functional test log** | Built-in table to mark each application test Pass or Fail and note a correction. |
| **Safe error handling** | Unsupported or oversized files, invalid or unreachable model URLs, and classifying before a model is loaded all show a message. A failed load never replaces a working model. |

---

## Quick start

### 1. Get the files

Clone or download this repository. The app lives in the `src/` folder.

### 2. Run it from a web server

The webcam and local model folders need a proper web address, so **don't open `index.html` by double-clicking it.**

**Option A: VS Code Live Server** (easiest)
1. Install the *Live Server* extension.
2. Right-click `src/index.html` → **Open with Live Server**.

**Option B: Python**
```bash
cd src
python -m http.server 8000
```
Then open <http://localhost:8000>.

**Option C: Static hosting** (GitHub Pages, Netlify, Vercel). Upload the contents of `src/`. Hosted sites use HTTPS, which the webcam requires.

> An internet connection is required. TensorFlow.js and the Teachable Machine library load from a CDN, and Teachable Machine models are downloaded from Google's servers.

### 3. Load the models

Paste the model URLs from [Models used](#models-used) into the V1 and V2 boxes and click **Load V1** and **Load V2**. The URLs are remembered in your browser, so you only paste them once.

---

## How to use the app

### Step 1 · Load a model
- Paste a Teachable Machine link (or a local folder such as `models/v1/`) and click **Load**.
- The card turns green when loaded. The most recently loaded model becomes **active**.
- Click a loaded card to switch the active model. The active model controls the large result in Step 3 and the webcam.
- Load **both** V1 and V2 so every test runs on both with the same image.

### Step 2 · Choose a test image
Drop an image onto the box or click it to browse, then click **Classify image**.
Accepted: PNG, JPEG, WebP, up to 8 MB.

### Step 3 · Read the result
- The large text shows the highest-scoring class from the **active** model.
- When both models are loaded, V1 and V2 predictions are compared side by side.
- Bars show every class score. The orange marker is your uncertainty threshold, which you can change with the slider (40–95%).
- An orange warning appears when the prediction is uncertain.

> **Confidence is not accuracy.** A model can be confidently wrong. Always compare against the real class.

### Step 4 · Check all conditions
This step saves the most time. From **one photo** it creates six test versions:

| Condition | How it is generated |
|---|---|
| Upright | Centre-cropped to a square |
| Rotated 90° | Square crop turned 90° clockwise |
| Rotated 180° | Square crop upside down |
| Low lighting | 62% dark overlay |
| Complex background | Image shrunk onto a colourful pattern |
| Increased distance | Image shrunk to 35% on a plain background |

1. Choose the photo's **Actual class**.
2. Click **Test all conditions**.
3. Review each version. Click **See more** for all scores and the method used.
4. Click **Add all to log** to save all six results for V1 and V2.

The versions are generated identically every time, so V1 and V2 always receive the same inputs. Use **Download image** to save any generated version.

### Step 5 · Record the test
For a single uploaded image, such as a real photo:
1. Classify it.
2. Set the **Actual class** and **Condition**.
3. Click **Record result**.

Recording the same image again updates its row instead of duplicating it. Use **✕** to remove a row.

### Step 6 · Webcam recognition
Click **Start webcam**, allow camera access, and the active model classifies live. This is for demonstration only. Use image upload for the V1 vs V2 comparison.

### Step 7 · Functional test log
Run each application test (FT-01 to FT-10), click the result button to mark **Pass** or **Fail**, and write a correction for any failure. Click **Export functional tests** to save the table.

---

## Recommended lab workflow

**Goal: 36 test images = 6 conditions × 3 classes × 2 images per class.**

1. Collect **2 photos per class** (6 total). They must **not** be in your training data. The photos used here are in `test-images/`.
2. Load **V1 and V2**.
3. For each photo: set the actual class, **Test all conditions**, then **Add all to log**.
4. Check the summary. Every condition should read `x / 6` and both models should show 36 tests.
5. Click **Export V1**, **Export V2** and **Export comparison**.
6. Study the weakest conditions, retrain V2 with at least 15 new varied samples per class, and re-test with the same 36 images.

### Rules to keep results honest
- Use the **same 36 images** for V1 and V2.
- **Never train** on the evaluation images.
- **Never delete** incorrect results.

---

## Understanding the results

**Log table columns**

| Column | Meaning |
|---|---|
| Image | Test ID (T01, T02, …), file name and condition |
| Actual | The true class you selected |
| V1 / V2 | Predicted class and confidence. Green = correct, red = wrong |
| Change | **Improved** (V1 wrong → V2 right), **Regressed** (V1 right → V2 wrong), or **Same** |

**Summary table:** correct / tested for each condition and overall. Compare the V1 and V2 columns to see where retraining helped and where it hurt.

**Uncertainty warning:** appears when the top score is below the threshold, or when the top two classes are less than 15 points apart.

**Colour key:** green = correct or loaded, red = wrong or failed, orange = uncertain.

---

## Exported files

| Button | File | Contents |
|---|---|---|
| Export V1 | `V1-test-results.csv` | Test ID, Condition, Actual, Predicted, Confidence, Result, Image filename |
| Export V2 | `V2-test-results.csv` | Same columns for V2 |
| Export comparison | `V1-V2-comparison.csv` | Both models side by side with the Change column |
| Export functional tests | functional test CSV | Test ID, test, expected, result, correction |

Open the CSVs in Excel. Copies from this project's runs are in `documentation/`.

---

## Project structure

```
ICS106_Lab/
├── src/
│   ├── index.html            # page structure
│   ├── style.css             # layout and styling
│   └── script.js             # model loading, classification, logging, webcam
├── models/
│   └── model-links.txt       # V1 and V2 URLs
├── test-images/
│   ├── aluminum-can/         # 01-aluminum-can.jfif, 02-aluminum-can.webp
│   ├── paper/                # 01-paper.jpg, 02-paper.jfif
│   └── plastic-bottle/       # 01-plastic-bottle.jpeg, 02-plastic-bottle.jfif
├── documentation/
│   ├── laboratory-report.pdf
│   ├── V1-test-results.csv
│   ├── V2-test-results.csv
│   ├── V1-V2-comparison.csv
│   └── screenshots/
│       └── Smart-Object-Detection-UI.png
├── INSTRUCTIONS.md
└── README.md
```

---

## Models used

| Version | Role | URL |
|---|---|---|
| **V1** | Baseline | https://teachablemachine.withgoogle.com/models/-srVGQve0/ |
| **V2** | Improved (retrained with more varied samples) | https://teachablemachine.withgoogle.com/models/WRjiyFqYc/ |

Both models use the same three classes: **PAPER**, **PLASTIC BOTTLE**, **ALUMINUM CAN**.

To use your own models, export from Teachable Machine with **Export Model → TensorFlow.js → Upload (shareable link)** and paste the link. It looks like `https://teachablemachine.withgoogle.com/models/XXXXXXXXX/`.

V1 and V2 must have the **same class names in the same order**, or the comparison will warn you.

### Results at a glance

| Condition | V1 | V2 |
|---|---|---|
| Upright | 6 / 6 | 6 / 6 |
| Rotated 90° | 5 / 6 | 6 / 6 |
| Rotated 180° | 6 / 6 | 6 / 6 |
| Low lighting | 5 / 6 | 6 / 6 |
| Complex background | 5 / 6 | 5 / 6 |
| Increased distance | 3 / 6 | 4 / 6 |
| **Overall** | **30 / 36** | **33 / 36** |

V2 improved four predictions, regressed one (T12, paper at a distance), and still failed two plastic bottle cases (T23, T24).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Use a published Teachable Machine model URL" | Use the shareable link from *Upload (shareable link)*, ending in `/models/ID/`. |
| "Could not download model files" | Check your internet connection and that the model is published. |
| Local `models/v1/` folder fails | Run the app through a web server, not `file://`. |
| "Library unavailable" | The CDN scripts did not load. Check your connection. |
| Webcam does not start | Use `http://localhost` or HTTPS and allow camera permission. |
| Warning about different class names | V1 and V2 must have the same classes in the same order. |
| Buttons are greyed out | Load a model and choose an image first. |
| Image rejected | Use PNG, JPEG or WebP under 8 MB. |
| Log or URLs disappeared | They are stored in your browser. Clearing site data removes them, so export your CSVs regularly. |

---

## Limitations

- The six conditions are **simulated** from one photo, so they are a quick check and not a replacement for real photos taken in real dim light, clutter or distance.
- The test set is small: 36 images from six source photos, and the six conditions of one photo are not independent.
- A high confidence score does not mean a prediction is correct. Both models gave wrong answers at 86–94% confidence.
- Results depend on the model files hosted by Teachable Machine being available.

---

## Tech stack

- HTML, CSS and vanilla JavaScript (no build step)
- [TensorFlow.js](https://www.tensorflow.org/js) 1.3.1
- [@teachablemachine/image](https://github.com/googlecreativelab/teachablemachine-community) 0.8.3
- Google Teachable Machine for model training
- Browser `localStorage` for saved URLs and the test log

---

*ICS106 · Application Development and Emerging Technologies — Laboratory 10.*
*Confidence is not accuracy. A model can be confidently wrong, so judge it on held-out test evidence.*
