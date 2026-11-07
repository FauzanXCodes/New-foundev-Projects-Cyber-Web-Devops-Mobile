# Automatic Leaf Infection Identifier (plant-disease-identifier) — Setup & Test Workflow

This repository is the upstream Python project **Automatic leaf infection identification** (upstream repo `https://github.com/johri-lab/Automatic-leaf-infection-identifier`, per `README.md` and `project-metadata.json`). It segments a leaf image with OpenCV, extracts three features (total area, infected area, perimeter), and classifies the leaf as *infected* or *sufficiently healthy* with a Gaussian Naive Bayes model trained at runtime from a bundled CSV.

**Scope note — this is NOT an Android or iOS mobile app.** Despite the folder living under `Mobile App Development` and despite `project-metadata.json` claiming `"stack": "Flutter; TFLite; FastAPI"`, the actual code is a **Python 3 desktop GUI** (OpenCV + PyQt4) that opens native windows on the machine running it. There is no Android Gradle project, no Xcode project, no Flutter/Dart source, no camera/capture code, and no API server in this repository. The `project-metadata.json` stack/goal fields are inaccurate for this checkout; the real identity of the code is preserved throughout this document.

Everything below was derived by reading the files in this checkout. **No installation, build, or test was executed** — the pinned dependency set cannot be installed on the Python available on this machine (see §2.1 and §5). Steps that could not be verified are labelled as such.

---

### 1. Prerequisites

| Item | Required value | Where it comes from / how to check |
|---|---|---|
| Operating system | Windows 10/11 (or Linux/macOS) | `setup.py:39-40` lists `Operating System :: Windows` and `:: Linux` |
| Python | **3.6–3.7 era** interpreter. `setup.py:33-38` only declares classifiers up to Python 3.5; the committed `__pycache__\classifier.cpython-36.pyc` and `__pycache__\GUIdriver.cpython-36.pyc` show the code was last executed under **Python 3.6** | `py -0p` (lists installed interpreters) |
| Python 3.7 installer | Not present on this machine. `py -0p` reports only `3.12` → `C:\Program Files\Python312\python.exe` | `py -0p` |
| PyQt4 | **Not in `requirements.txt`** but imported by `GUIdriver.py:2` (`from PyQt4 import QtCore, QtGui, uic`) and `design.py:9`. The last PyPI release (4.11.4) is a source distribution, not a modern wheel | `requirements.txt`, `GUIdriver.py:2`, `design.py:9` |
| A display / GUI session | Required. `main.py` calls `cv2.imshow(...)` repeatedly (lines 21, 46, 58, 88, 114, 115, 122, 124, 132, 137, 143, 180) and `GUIdriver.py` opens a `QMainWindow` | `main.py`, `GUIdriver.py` |
| Docker (optional alternative) | **Not installed on this machine** — `docker --version` returns "docker not found". Usable as an alternative way to get a Python 3.7 runtime | `docker --version` |
| Model file | **None needed and none present.** No `.pkl`, `.h5`, `.sav`, `.pickle`, `.joblib`, `.onnx`, `.pt`, `.pth`, `.model` or `.tflite` file exists anywhere in the tree. `classifier.py:54-56` fits a `GaussianNB` in memory on every run | glob over the whole project folder returned no matches |
| Training dataset | Present: `Datasetinfectedhealthy.csv` (1 header line + 114 data lines). Columns: `fold num,imgid,label,feature1,feature2,feature3` | read of the CSV |
| Environment variables | **None.** There is no `.env`, no `os.environ` lookup, and no config file consumed at runtime | grep/read of all `.py` files |
| Ports | **None.** Desktop GUI; it opens no network listener and connects to no server | `main.py`, `classifier.py` |

---

### 2. Installation and Setup

#### 2.1 The pinned-dependency blocker (read this first)

`requirements.txt` pins a 2018-era stack:

```
matplotlib==3.0.2
numpy==1.15.4
opencv-python==3.4.5.20
pandas==0.23.4
scikit-learn==0.20.2
sklearn==0.0
```

Consequences, all verified by reading the file:

- **These pins cannot be installed on Python 3.12** (the only interpreter present here). `numpy==1.15.4`, `pandas==0.23.4`, `matplotlib==3.0.2` and `opencv-python==3.4.5.20` predate 3.12 and have no compatible wheels; `scikit-learn==0.20.2` requires a compatible `scipy`, which `requirements.txt` does not pin at all.
- **`sklearn==0.0` is a legacy placeholder package**, not a machine-learning library. The PyPI distribution named `sklearn` is an old dummy/placeholder that shadows the real project; the real library is `scikit-learn` (also pinned, separately). Installing `sklearn==0.0` does not give you `sklearn.naive_bayes.GaussianNB` — that import (`classifier.py:6`) is satisfied only by the genuine `scikit-learn==0.20.2` install.
- **PyQt4 is missing from `requirements.txt`** even though the GUI cannot start without it.

#### 2.2 Create a Python 3.6/3.7 environment (Windows, PowerShell)

You need a 3.6/3.7 interpreter first; it is **not** installed on this machine. Install it (python.org 3.7.9 installer, or `winget install Python.Python.3.7`), then:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\plant-disease-identifier"
py -3.7 -m venv .venv
.\.venv\Scripts\Activate.ps1
python --version
python -m pip install --upgrade pip
```

Expect `Python 3.7.x` from `python --version`. If `py -3.7` reports "no suitable Python interpreter found", stop here — the blocker is unresolved.

#### 2.3 Install dependencies (expected to be the fragile step)

```powershell
python -m pip install -r requirements.txt
python -m pip install PyQt4
```

Notes, all unverified by execution:

- `PyQt4` is not a wheel for modern Pythons; on 3.7 it may need a source build (SIP) or a conda-forge environment. `conda create -n leaf python=3.7 pyqt=4` is the alternative route.
- `scipy` is pulled in transitively by `scikit-learn`; pin it explicitly if the resolver picks an incompatible version.
- `pip install .` / `python setup.py install` (`setup.py:17-41`) is also advertised by `README.md:86-88`; `setup.py:26` feeds the *entire* `requirements.txt` (including `sklearn==0.0`) into `install_requires`, so it inherits the same problems. `setup.py` also declares `Programming Language :: Python :: 2` and `2.7` classifiers.

#### 2.4 Prepare the data folders (optional, for the dataset-creation scripts)

- `Image Dataset\` holds 6 archives — `img1.zip`, `img2.zip`, `img3.zip`, `img4.zip`, `img6.zip`, `img9.zip` (roughly 28 MB to 52 MB each). They are **not extracted**. Each archive contains a top-level folder `imgN\` with one sub-folder per disease class; `img1.zip` for example contains 3176 entries across 4 classes: `Apple___Apple_scab`, `Apple___Black_rot`, `Apple___Cedar_apple_rust`, `Apple___healthy`. Extract only if you want to rebuild the training CSV.
- `testimage\` holds 8 ready-to-use inputs: `1.png`, `2.png`, `3.png`, `4.png`, `leaf1.jpg`, `leaf2.jpg`, `leaf3.jpg`, `leaf4.jpg`.
- `leaf sampler\` holds `leaf1.jpg`–`leaf4.jpg` plus the two dataset-builder scripts.
- `datasetlog\` **does not exist** in the repo. `main.py:196-227` creates it and writes `Datasetunlabelledlog.csv` at runtime; `classifier.py:24` then reads that file. If `classifier.py` is ever run standalone, it fails with `FileNotFoundError` until `main.py` has produced the log.

---

### 3. Launch the Complete Project

#### 3.1 Launch the GUI (the documented entry point)

`README.md:114-118` specifies `python3 GUIdriver.py`. On Windows PowerShell:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\plant-disease-identifier"
.\.venv\Scripts\Activate.ps1
python GUIdriver.py
```

Entry point chain, as read from the code:

- `GUIdriver.py:26-30` — `if __name__ == "__main__":` creates `QtGui.QApplication`, instantiates `MyApp` (a `QtGui.QMainWindow` built from `design.ui` via `uic.loadUiType`, `GUIdriver.py:6`), shows it, and enters the event loop.
- `GUIdriver.py:16-20` — the **Browse** button opens a file dialog and then `exec(open('main.py').read())` runs the whole pipeline inside the GUI process.
- `main.py` — segmentation pipeline: white-pixel percentage → Gaussian blur → `pyrMeanShiftFiltering` → Canny edges → largest contour → ROI → BGR→HLS → hue masking → threshold → infected-area accumulation → prints perimeter / total area / infected area / % infection.
- `main.py:186-190` then prompts `Do you want to run the classifier(Y/N):` and **reads the answer with `cv2.waitKey(0)`** — the keypress must land on one of the OpenCV image windows, not in the terminal.
- `main.py:230` — answering `y` appends a row to `datasetlog/Datasetunlabelledlog.csv` and `import classifier` runs the Naive Bayes prediction; answering `n` skips it.

#### 3.2 What the user sees on a successful run

The main window (from `design.ui`, mirrored in `design.py`) contains an "ABOUT" text panel, an "Interact" panel with the **Browse** button, an "Implementation" step list, a "Contact Us" link, and a **Close Application** button. During processing, `main.py` opens OpenCV windows named `original`, `color change`, `means shift image`, `Contour`, `ROI`, `rectangle ROI`, `HLS`, `new HLS`, `img_hue hls`, `img_hue with my mask`, `thresh`, `masked out img`, `Contour masked`, `orig`.

#### 3.3 Dataset-creation scripts (secondary entry points)

`README.md:97-107` documents these; both are in `leaf sampler\` and take a required `-i` directory argument:

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\plant-disease-identifier\leaf sampler"
python leafdetectionALLsametype.py -i .
python leafdetectionALLmix.py -i .
```

`leafdetectionALLsametype.py` labels every image in the directory with one label; `leafdetectionALLmix.py` prompts per image for infected/healthy and writes `datasetleafmixed.csv`. Both filter inputs to `.jpg/.JPG/.jpeg/.JPEG/.png/.PNG` (`leafdetectionALLmix.py:55`).

---

### 4. Test the Project

**There is no automated test suite in this repository.** There is no `tests/` folder, no `pytest`/`unittest`/`tox` configuration, and no CI workflow. The only test-like artefacts are the manual sample images in `testimage\` and the committed `__pycache__\*.cpython-36.pyc` files. The verification below is therefore **manual and interactive**, and every step is marked as not yet executed.

#### 4.1 Manual acceptance path (interactive, GUI)

| # | Step | Expected observable result | Status |
|---|---|---|---|
| 1 | `python GUIdriver.py` | A 736×624 `MainWindow` appears with the ABOUT/Interact panels (size from `design.py:28`) | Not run |
| 2 | Click **Browse**, pick `..\testimage\leaf1.jpg` | A file dialog returns a path; OpenCV windows open | Not run |
| 3 | Observe the pipeline windows | `original` → `means shift image` → `Contour` → `ROI` → `HLS` → `thresh` → `masked out img` | Not run |
| 4 | Read the console | Four blocks print: `Perimeter`, `Total area`, `Infected area`, `Percentage of infection region` (`main.py:159-176`) | Not run |
| 5 | Press `y` on an OpenCV window | `datasetlog\Datasetunlabelledlog.csv` is created/updated and `classifier.py` runs: 4 Naive Bayes fits, `prediction: <n>`, then either `The leaf is sufficiently healthy!` or `The leaf is infected!` (`classifier.py:51-65`) | Not run |
| 6 | Repeat with `leaf2.jpg` … `leaf4.jpg` and `1.png` … `4.png` | Consistent behaviour for all 8 sample images | Not run |

#### 4.2 Non-interactive sanity check of the classifier (optional)

`classifier.py` can be exercised against the shipped training CSV, but it needs `datasetlog\Datasetunlabelledlog.csv` to exist (it is read at `classifier.py:24`, before any model is fitted). To create it without the GUI you would have to hand-write a CSV with the header `fold num,imgid,feature1,feature2,feature3` and one data row. This is a manual, error-prone path and is **not** verified here.

#### 4.3 Known code-level issues that will affect a test run

These were found by reading the source; they are **observations, not reproduced failures**:

- **PyQt4 file-dialog return type.** `GUIdriver.py:19` calls `QtGui.QFileDialog.getOpenFileName(...)` without unpacking. In PyQt4 that call returns a tuple `(path, filter)`, whereas `main.py:14` does `text = str(ImageFile)` and `main.py:16` does `cv2.imread(text)`. If the tuple is passed through unchanged, `cv2.imread` receives a non-path string and returns `None`, which makes `main.py:18` (`img.shape`) raise `AttributeError`. This is the single most likely first-run failure.
- **Circular import.** `main.py:4` does `from GUIdriver import *` while `GUIdriver.py:20` `exec`s `main.py`. Running `python main.py` directly does not have a valid `ImageFile` and is not the supported path; only `GUIdriver.py` is.
- **White-pixel correction is a no-op.** `main.py:44-46` sets `img[i][j] = [200,200,200]`, but `i`/`j` are the leftovers of the loop that ended at `main.py:26-32`, so only one pixel is changed instead of the whole white region.
- **Unbound variables on poor images.** `maxid` (`main.py:79-82`) and `roi`/`originalroi` (`main.py:100-111`) are only assigned inside loops; an image that yields no contour of width/height > 80 raises `NameError`/`UnboundLocalError`.
- **`os.system('clear')` on Windows.** `leafdetectionALLmix.py:16` and `leafdetectionALLsametype.py:15` call `clear`, which runs `os.system('clear')`; `clear` is not a Windows `cmd` command and will print an error (the sampler still continues).
- **Two different input channels.** The samplers read Y/N from the console via `input()` (`leafdetectionALLmix.py:57`), while `main.py` and the samplers' labelling step read keys from an OpenCV window via `cv2.waitKey(0)`. Mixing them in one workflow causes "invalid input" branches to fire.
- **`mkdir` assumption.** `main.py:220` uses `os.system('mkdir ' + directory)` (no `-p`); it happens to work on Windows, but it is POSIX-flavoured and silently depends on the shell.
- **Headless machines.** Any environment without a display (CI, some remote sessions) will fail at `cv2.imshow` / `QtGui.QApplication`.

---

### 5. Troubleshooting

| Symptom | Likely cause | Action (Windows PowerShell) | Verified? |
|---|---|---|---|
| `ERROR: No matching distribution found for numpy==1.15.4` | The pins predate Python 3.12 | Install Python 3.7 and use `py -3.7 -m venv .venv`; see §2.2 | Cause verified from `requirements.txt`; fix not executed |
| `py -3.7` → "no suitable Python interpreter found" | No 3.6/3.7 interpreter on this machine (`py -0p` shows only 3.12) | Install Python 3.7 (python.org / `winget install Python.Python.3.7`) or use a Docker image with Python 3.7 | Verified via `py -0p` |
| `ModuleNotFoundError: No module named 'PyQt4'` | PyQt4 is not in `requirements.txt` | `python -m pip install PyQt4` in the 3.7 venv, or use a conda env with `pyqt=4` | Verified that it is absent from `requirements.txt` |
| `ModuleNotFoundError: No module named 'sklearn'` after a successful install | `sklearn==0.0` is a placeholder package, not the real library | Install `scikit-learn==0.20.2` explicitly and ensure the placeholder does not shadow it | Verified from `requirements.txt` and `classifier.py:6` |
| `ImportError: cannot import name 'uic'` / `AttributeError: module 'PyQt4.QtGui' has no attribute 'QApplication'` | Wrong Qt binding or a broken PyQt4 install | Confirm `from PyQt4 import QtCore, QtGui, uic` works in the venv (`python -c "from PyQt4 import QtCore, QtGui, uic"`) | Not executed |
| `AttributeError: 'NoneType' object has no attribute 'shape'` at `main.py:18` | The PyQt4 file dialog returned a tuple, so `str(ImageFile)` is not a path | Open the image path through a path-patching shim, or move to PyQt5 semantics — requires a code change; until then, the GUI's Browse flow is suspect | Code-reading observation only |
| `FileNotFoundError: datasetlog/Datasetunlabelledlog.csv` | `classifier.py` ran before `main.py` created the log | Run the GUI flow first (answer `y` at the prompt) so `main.py:196-227` creates the folder and CSV | Verified from the code paths |
| `UnboundLocalError: local variable 'roi' referenced before assignment` | No contour larger than 80×80 px in the chosen image | Try the other images in `testimage\` (`1.png`–`4.png`, `leaf1.jpg`–`leaf4.jpg`) | Code-reading observation only |
| `cv2.error: ... the function is not implemented` / window never appears | No display available | Run on a machine with an interactive desktop session; do not attempt this over a plain SSH session | Not executed |
| `clear` is not recognized as an internal or external command | `os.system('clear')` in the sampler scripts | Ignore the message (it is cosmetic) or run the samplers under Git Bash / WSL | Verified from `leafdetectionALLmix.py:16` |
| `python: command not found` / `python` is a different version | PATH points at another interpreter | Always use `.\.venv\Scripts\python.exe` or activate the venv first | Not executed |

---

### 6. Verification Checklist

Every item below is **unchecked** because no installation, build, or test run was performed for this project. Tick each box only after you have personally observed the stated result on your machine.

- [ ] A Python 3.6 or 3.7 interpreter is installed and `py -0p` lists it.
- [ ] A virtual environment was created in the project folder and `python --version` reports 3.6/3.7.
- [ ] `python -m pip install -r requirements.txt` completed without dependency-resolution errors.
- [ ] PyQt4 imports successfully (`python -c "from PyQt4 import QtCore, QtGui, uic"`).
- [ ] `python -c "import cv2, numpy, pandas, matplotlib, sklearn; print(cv2.__version__)"` succeeds and reports a 3.x OpenCV version.
- [ ] `python GUIdriver.py` opens the "MainWindow" with the ABOUT/Interact panels.
- [ ] The **Browse** button opens a file dialog and a selected image is accepted.
- [ ] The OpenCV pipeline windows appear in the documented order.
- [ ] The console prints Perimeter, Total area, Infected area, and Percentage of infection region for `testimage\leaf1.jpg`.
- [ ] Pressing `y` creates `datasetlog\Datasetunlabelledlog.csv`.
- [ ] `classifier.py` prints `prediction: <n>` and either `The leaf is sufficiently healthy!` or `The leaf is infected!`.
- [ ] All 8 images in `testimage\` were processed without an unhandled exception.
- [ ] `python "leaf sampler\leafdetectionALLmix.py" -i .` runs (after extracting a dataset directory, if desired).
- [ ] `Datasetinfectedhealthy.csv` was read successfully by `pandas` (114 data rows).

---

#### Known limitations to state honestly

- **This is not a mobile app.** It is a Python/OpenCV/PyQt4 desktop GUI. There is no Android, iOS, Flutter, TFLite, camera capture, or API server in the repository, notwithstanding `project-metadata.json`.
- **The documented install cannot be completed on this machine as-is.** The only interpreter present is Python 3.12, and the pinned 2018 dependencies have no compatible distributions for it. Installing Python 3.7 (or Docker, which is also absent) is a prerequisite, not an optional convenience.
- **No build, install, or test was executed while writing this document.** Every "expected" result in §4 and every unchecked box in §6 is a prediction from source reading, not an observation.
- **There is no automated test suite and no CI** — validation is entirely manual and interactive, and it depends on clicking OpenCV windows.
- **No trained model artefact ships with the project.** The Naive Bayes model is refitted from `Datasetinfectedhealthy.csv` on every run, so results depend on that 114-row CSV being present and correctly formatted.
- **`requirements.txt` is incomplete and partly hostile**: it omits PyQt4 (mandatory) and `scipy`, and it includes the placeholder `sklearn==0.0` alongside the real `scikit-learn`.
- **The source contains latent bugs** (PyQt4 tuple return, single-pixel white correction, possibly-unbound `maxid`/`roi`) that were identified by reading the code and may prevent a clean first run.
- **The bulk dataset is un-extracted** (6 large ZIPs) and is only needed for retraining, not for the GUI smoke test.
