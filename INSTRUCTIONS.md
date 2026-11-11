# Smart Object Recognition

**ICS 106 · Laboratory 10** — a JavaScript web app that loads Google Teachable Machine image models (V1 and V2), classifies images, and measures how reliably each model performs under different real-world conditions.

The app is built to answer one question: *does my improved model (V2) actually beat my baseline (V1), and where does it still fail?*

---

## Features

| Feature | What it does |
|---|---|
| **Two models at once** | Load V1 (baseline) and V2 (improved) side by side. Every test runs on both with the identical image. |
| **Image upload** | Drag and drop or browse. PNG, JPEG, or WebP, up to 8 MB. Invalid files show an error. |
| **Full score display** | Predicted class, confidence for every class, and the highest-scoring class highlighted. |
| **Uncertainty warning** | Flags a result when the top score is under your threshold or the top two classes are too close. |
| **Condition check** | Generates six versions of one image (upright, 90°, 180°, low lighting, complex background, increased distance) and classifies each. |
| **Test log** | Records V1 and V2 results in one row, with an Improved / Regressed / Same column. |
| **Accuracy summary** | Live per-condition and overall accuracy for both models. |
| **CSV export** | Export V1 results, V2 results, or a side-by-side comparison (opens in Excel). |
| **Webcam recognition** | Live classification from your camera using the active model. |

---

## Quick Start

1. **Get your model URLs.** In Teachable Machine, choose *Export Model → TensorFlow.js → Upload (shareable link)* and copy the link. It looks like:
   `https://teachablemachine.withgoogle.com/models/XXXXXXXXX/`
2. **Open the app.** Use a local server or hosting (see [Running the App](#running-the-app)).
3. **Paste the V1 URL**, click **Load V1**. Paste the V2 URL, click **Load V2**.
4. **Pick a test image** and click **Classify image**.

The URLs are remembered in your browser, so you only paste them once.

---

## Running the App

The camera and local model folders need a proper web address, so avoid opening `index.html` by double-clicking.

**Option A: VS Code Live Server** (easiest). Install the *Live Server* extension, right-click `index.html`, then *Open with Live Server*.

**Option B: Python**
```bash
cd ICS106_Lab/source-code
python -m http.server 8000
```
Then open <http://localhost:8000>.

**Option C: GitHub Pages / Netlify.** Upload the three files. Hosted sites use https, which the webcam requires.

> An internet connection is required: the TensorFlow.js and Teachable Machine libraries load from a CDN.

---

## Step-by-Step Guide

### Step 1 · Load a model
- Paste a Teachable Machine link (or a local folder such as `models/v1/`) and click **Load**.
- The loaded card turns green. The newest loaded model becomes **active**.
- Click a loaded card to switch the active model. The active model controls what is displayed in step 3.
- Invalid or unreachable URLs show an error and never replace a working model.

### Step 2 · Choose a test image
Drop an image onto the box or click to browse. Click **Classify image**.

### Step 3 · Read the result
- Large text: the highest-scoring class from the **active** model.
- Below it: V1 and V2 predictions side by side (when both are loaded).
- Bars show every class score. The orange marker is your uncertainty threshold.
- **A high confidence score does not mean the answer is correct.** Always compare with the real class.

### Step 4 · Check all conditions
This step saves the most time. From **one photo** it creates six test versions:

| Condition | How it is generated |
|---|---|
| Upright | Center-cropped to a square |
| Rotated 90° | Square crop turned 90° clockwise |
| Rotated 180° | Square crop upside down |
| Low lighting | 62% dark overlay |
| Complex background | Image shrunk onto a colorful pattern |
| Increased distance | Image shrunk to 35% on a plain background |

1. Choose the **Actual class** of the photo.
2. Click **Test all conditions**.
3. Review each version (click **See more** for all scores and the method).
4. Click **Add all to log** to save all six results for V1 and V2.

The versions are generated identically every time, so V1 and V2 always receive the same inputs. Use **Download image** to save any generated version.

### Step 5 · Record the test
For a single uploaded image (for example, a real photo):
1. Classify it.
2. Set the **Actual class** and **Condition**.
3. Click **Record result**.

Recording the same image again updates its row instead of duplicating it. Use the ✕ button to remove a row.

### Step 6 · Webcam recognition
Click **Start webcam**, allow camera access, and the active model classifies live. This is for demonstration. Use image upload for the V1 vs V2 comparison.

---

## Recommended Workflow for the Lab

**Goal: 36 test images = 6 conditions × 3 classes × 2 images per class.**

1. Collect **2 photos per class** (6 total). They must **not** be in your training data.
2. Load **V1 and V2**.
3. For each photo: set the actual class, **Test all conditions**, **Add all to log**.
4. Check the summary: every condition should read `x / 6` and the count should show 36 for V1 and V2.
5. Click **Export V1** and **Export V2** for your result files, and **Export comparison** for the side-by-side table.
6. Study the lowest conditions, then retrain V2 with at least 15 new varied samples per class and re-test.

> The generated conditions are simulated from one photo. If your instructor requires real photos for lighting, background or distance, take those photos and log them with step 5.

### Rules to keep your results honest
- Use the **same 36 images** for V1 and V2.
- **Never train** on the evaluation images.
- **Never delete** incorrect results.

---

## Understanding the Results

**Log table columns**

| Column | Meaning |
|---|---|
| Image | Test ID (T01, T02, …) and file name, plus the condition |
| Actual | The true class you selected |
| V1 / V2 | Predicted class and confidence. Green = correct, red = wrong |
| Change | **Improved** (V1 wrong → V2 right), **Regressed** (V1 right → V2 wrong), or **Same** |

**Summary table:** correct / tested for each condition and overall. Compare the V1 and V2 columns to find where the retrained model helped and where it got worse.

**Uncertainty warning:** appears when the top score is below the threshold (adjust the slider, default 70%) or the top two classes are within 15 points.

---

## Exported Files

| Button | File | Contents |
|---|---|---|
| Export V1 | `V1-test-results.csv` | Test ID, Condition, Actual, Predicted, Confidence, Result |
| Export V2 | `V2-test-results.csv` | Same columns for V2 |
| Export comparison | `V1-V2-comparison.csv` | Both models side by side with the Change column |

Open them in Excel and save as `.xlsx` for the submission package.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Use a published Teachable Machine model URL" | Use the shareable link from the *Upload (shareable link)* export option, ending in `/models/ID/`. |
| "Could not download model files" | Check your internet connection and that the model is published. |
| Local `models/v1/` folder fails | Run the app through a web server (not `file://`). |
| "Library unavailable" | The CDN scripts did not load. Check your internet connection. |
| Webcam does not start | Use `http://localhost` or `https`, and allow camera permission. |
| Warning about different class names | V1 and V2 must have the same classes in the same order. Retrain V2 with the original class names. |
| Buttons are greyed out | Load a model and choose an image first. |
| Log lost after clearing browser data | The log is stored in your browser. Export your CSVs regularly. |

---

## Project Structure

```
ICS106_Lab/
├── source-code/
│   ├── index.html       # page structure
│   ├── style.css        # styling
│   └── script.js        # model loading, classification, logging, webcam
├── models/
│   └── model-links.txt  # V1 and V2 URLs
├── test-images/
│   ├── class-1/
│   ├── class-2/
│   └── class-3/
└── documentation/
    ├── laboratory-report.pdf
    ├── V1-test-results.xlsx
    ├── V2-test-results.xlsx
    └── screenshots/
```



*Confidence is not accuracy. A model can be confidently wrong, so judge it on held-out test evidence.*