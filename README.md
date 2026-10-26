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

The cards in the side panel choose the method. Each small 3 by 3 icon shows
what the method may use: rows are slices, columns are time points, the centre
is the frame on screen.

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
predicting them, with an amber dot on the best. The smoothing slider acts on
all methods at once.

Interpolation uses radial basis functions with a thin plate spline kernel,
fitted on small overlapping patches and blended so the result has no seams.
CS + interpolation turns the interpolated field into weak extra samples in
the gaps and lets CS reconcile them with the real ones.

This is gap filling with a measured error, not compressed sensing in the
strict sense: the samples are image voxels that survived a reliability test,
not random k space samples.

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

## Updating the data

The viewer reads one `data/` folder. To put a different set of workbooks on
screen, replace that folder with the converted data for the new set, keep the
same file names, and reload. The conversion itself is a one off job that is
done away from the hosted page.

## Files

| file | purpose |
| --- | --- |
| `viewer.html` | the page: start screen, viewer, solver |
| `index.html` | redirect at the folder root |
| `.nojekyll` | tells GitHub Pages not to process the folder |
| `data/` | manifest and the packed volumes |
