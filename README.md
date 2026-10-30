# MRT data reconstruction

A static web page that shows MR thermometry maps and reconstructs the missing
voxels in the browser. Nothing runs on a server. Open `viewer.html` and the
whole tool is there.

## Two tiles

**MRT View data** opens the measured maps as exported. Scroll to move through
slices or time, use the play buttons on either rail, hover for values, click
to pin a voxel.

**MRT Reconstruction** shows the measured map on the left and the
reconstruction on the right, with the cursor linked between them. The
reconstruction is computed live in the browser for whatever you look at,
then fills in the rest of the stack in the background. Rail ticks turn amber
once their slice or time point is ready.

The date under the two tiles is the date of the data in `data/`.

## Fill the gaps using

The reconstruction opens on CS 2D. The cards in the side panel choose the
method. Each small 3 by 3 icon shows what the method may use: rows are
slices, columns are time points, the centre is the frame on screen.

| group | card | uses |
| --- | --- | --- |
| CS | 2D | this slice |
| CS | 3D | also the slice before and after |
| CS | 2D + time | this slice at every time point |
| CS | 3D + time | the slice before and after, at every time point |
| Interpolation | 2D | the samples of this slice |
| Interpolation | 3D | also the slice before and after |
| | CS + interpolation | interpolation guides CS in the gaps, slice before and after |

Each card reports its typical error, measured live by hiding real samples and
predicting them, with an amber dot on the best. While anything is still being
computed, a popup at the bottom of the image shows the progress.

### What the CS cards do

All CS cards look for a temperature field that stays close to the measured
voxels and is smooth, meaning neighbouring voxels should not differ much. They
differ only in what counts as a neighbour. 2D uses the in plane neighbours.
3D also links each voxel to the voxels directly above and below it in the
slice before and after. Time links each voxel to the same voxel at the
previous and next time point.

How strongly slices and time points are linked is calibrated per series with
the holdout test, on slices and time points the cards do not report on, and
stored in `data/manifest.json`. A link that made predictions worse is
switched off; its cells in the card icon are then drawn dashed. On the data
in this package, the time link stays on for cumulative maps, where the same
voxel at neighbouring time points correlates strongly (0.74 to 0.82), and is
switched off or nearly off for consecutive maps, where each map is an
increment between two dynamics and those increments are almost unrelated
(0.09 and 0.32). As a result, adding context never makes a card worse than
leaving it out.

Interpolation uses radial basis functions with a thin plate spline kernel,
fitted on small overlapping patches and blended so the result has no seams.
CS + interpolation turns the interpolated field into weak extra samples in the
gaps and lets CS reconcile them with the real ones.

This is gap filling with a measured error, not compressed sensing in the
strict sense: the samples are image voxels that survived a reliability test,
not random k space samples.

## Probes

The Analysis tab lists every probe with the temperature at its tip, and the
mean and median over all its points, for the time point on screen. The chart
below follows the tip (solid) and the mean (dashed) through time, one colour
per probe. On the image, each probe's points are tinted and its tip is marked
with a ring on the tip's own slice.

The tip is the far end of the probe track, deep in the body: the centre of the
largest piece of the probe on its last sheet. The masks start on sheet 1
where the catheters enter, and the few probe points outside the body (sheets
1 to 3) are left out of the statistics, because the maps carry no values
there. To place a tip somewhere else, pin a voxel and press "Move tip to pin";
"Reset tip" brings it back. Moved tips are remembered in this browser.

In MRT View data the probe values come from measured voxels only, and most
probe points carry no measurement at a given time point (1 to 19 percent are
measured here). In MRT Reconstruction every probe point inside the body has a
value: measured points keep their measured value, and only the unmeasured
points are estimated, so a mean over all probe points differs from the
measured mean only because it includes the unmeasured points.

The maps hold the rise over the reference scan. Under Personalization,
Temperatures, a baseline (37 °C by default) can be added so the probe values
and the probe export read as absolute temperatures.

## Export

The export button in the image toolbar opens one menu:

| item | file | contents |
| --- | --- | --- |
| Image of this view | PNG | what is on screen, with the colour bar and labels |
| Probe temperatures | XLSX | per probe and time point: tip, mean, median, measured and reconstructed, plus probe positions and an About sheet |
| Reconstructed field | XLSX | the time point on screen, 25 sheets laid out exactly like the input workbooks |
| Reconstructed fields, all time points | ZIP | one such workbook per time point, plus About.txt |

The two field exports appear in MRT Reconstruction. Each row says whether the
reconstruction it needs is complete; if not, pressing it asks the solver for
exactly those frames first, shows the progress, and saves the file when done.

Field workbooks are named after the input (for example
`MRT_P1_T4_reconstructed_CS_2D.xlsx`), hold the temperature rise in °C with
three decimals, and 0 outside the body, so existing scripts that read the
input workbooks can read them unchanged. Inside the body a reconstructed rise
of exactly 0 is possible; use the body mask to tell the two apart.

## Stats

The Stats tab in the side panel lists coverage, median, p95 and maximum for
the slice on screen and for the whole volume at that time point. In
reconstruction mode a second column holds the same figures for the
reconstruction. The whole volume column appears once every slice has been
filled.

## Running it

**On a server such as GitHub Pages or Cloudflare Pages**, upload the three
items `viewer.html`, `index.html`, `.nojekyll` and the `data/` folder together.
Nothing else is needed.

**On your own machine**, a browser cannot open the page straight off disk
because it will not read `data/*.bin.gz` from a `file://` address. Any static
file server works:

```
python3 -m http.server 8000
```

Then open <http://127.0.0.1:8000/>.

## Personalization

Besides the colour window, palette, overlays and playback, the Personalization
tab holds the reconstruction smoothing (shown in reconstruction mode only). It
starts at 60 % and runs from following the samples closely to smoothing more.

## Updating the data

The viewer reads one `data/` folder. To put a different set of workbooks on
screen, replace that folder with the converted data for the new set, keep the
same file names, and reload. The conversion itself is a one off job that is
done away from the hosted page.

After replacing the data, calibrate the slice and time links once:

```
node tools/calibrate.cjs
```

It needs Node.js 18 or newer, uses the solver inside `viewer.html`, takes a
few minutes per series and writes the weights into `data/manifest.json`.
Without it the page falls back to fixed default weights.

## Files

| file | purpose |
| --- | --- |
| `viewer.html` | the page: start screen, viewer, solver |
| `index.html` | redirect at the folder root |
| `.nojekyll` | tells GitHub Pages not to process the folder |
| `data/` | manifest, calibrated weights and the packed volumes |
| `tools/calibrate.cjs` | calibrates the slice and time links after new data |
