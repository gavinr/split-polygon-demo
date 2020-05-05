// doc:
// http://esri.github.io/esri-leaflet/
var map = L.map("map").setView([34, -98.57], 6);
L.esri.basemapLayer("Topographic").addTo(map);

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
var drawControl = new L.Control.Draw({
  draw: false,
  edit: false,
});
map.addControl(drawControl);

function getColor(c) {
  return c === 1
    ? "#a6cee3"
    : c === 2
    ? "#1f78b4"
    : c === 3
    ? "#b2df8a"
    : c === 4
    ? "#33a02c"
    : c === 5
    ? "#fb9a99"
    : c === 6
    ? "#e31a1c"
    : c === 7
    ? "#fdbf6f"
    : c === 8
    ? "#ff7f00"
    : c === 9
    ? "#cab2d6"
    : "#6a3d9a";
}

let currentStep = 0;
let polygon;
let polygonBbox;
let pointsLayer;
let clusteredPointsLayer;
let points;
let numberOfClusters = 8;
let clustered;
let clusterGroups;
let centroids;
let centroidLayer;
let voronoiLayer;
let voronoiPolygons;
let voronoiClipLayer;
let clipped;

map.on(L.Draw.Event.CREATED, (e) => {
  let layer = e.layer;
  polygon = layer;
  polygon.addTo(map);
  polygonBbox = turf.bbox(polygon.toGeoJSON());
  enableAll();
});

// Gets called when entering the first ("Polygon") step
const disableAll = () => {
  for (let a = 0; a < steps.length; a++) {
    let s = `calcite-stepper > *:nth-child(${a + 1})`;
    let st = document.querySelector(s);
    if (a > 0) {
      st.setAttribute("disabled", "");
    } else {
      st.removeAttribute("disabled");
    }
  }

  // Show the "please draw .." message on the first step.
  document
    .querySelector(`calcite-stepper > *:nth-child(1)`)
    .setAttribute("item-subtitle", "Please draw a polygon on the map.");
};

// Gets called when polygon has been drawn in the first step.
const enableAll = () => {
  for (let a = 0; a < steps.length; a++) {
    let s = `calcite-stepper > *:nth-child(${a + 1})`;
    let st = document.querySelector(s);
    st.removeAttribute("disabled");
  }
  document
    .querySelector(`calcite-stepper > *:nth-child(1)`)
    .setAttribute("item-subtitle", "Click twice to draw your own.");
};

// STEP 1 ----------------------------------------------------------------------
const showPolygon = () => {
  if (!polygon) {
    polygon = L.polygon([
      [39, -97],
      [30, -99],
      [39, -90],
    ]).addTo(map);
    polygonBbox = turf.bbox(polygon.toGeoJSON());
  }
};
const showDrawPolygon = () => {
  if (polygon) {
    map.removeLayer(polygon);
    polygon = undefined;
  }
  disableAll();
  new L.Draw.Polygon(map, drawControl.options.polygon).enable();
};
const showPolygonDestroy = () => {};

// STEP 2 ----------------------------------------------------------------------
const randomPointsStep = () => {
  if (!points) {
    points = turf.randomPoint(1000, { bbox: polygonBbox });

    points.features = points.features.filter((feature) => {
      return turf.booleanPointInPolygon(
        feature.geometry.coordinates,
        polygon.toGeoJSON()
      );
    });
  }
  if (!pointsLayer) {
    pointsLayer = L.geoJSON(points, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 5,
          fillColor: "#800026",
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
        });
      },
    }).addTo(map);
  }
};
const randomPointsDestroy = () => {
  points = undefined;
  if (pointsLayer) {
    map.removeLayer(pointsLayer);
    pointsLayer = undefined;
  }
};

// STEP 3 ----------------------------------------------------------------------
const clusterStep = () => {
  if (pointsLayer) {
    map.removeLayer(pointsLayer);
  }

  if (!clustered) {
    clustered = turf.clustersKmeans(points, {
      numberOfClusters: numberOfClusters,
    });

    clusteredPointsLayer = L.geoJSON(clustered, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 5,
          fillColor: getColor(feature.properties.cluster),
          color: "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
        });
      },
    }).addTo(map);
  }
};
const clusterDestroy = () => {
  clustered = undefined;
  if (clusteredPointsLayer) {
    map.removeLayer(clusteredPointsLayer);
    clusteredPointsLayer = undefined;
  }
  if (pointsLayer) {
    pointsLayer.addTo(map);
  }
};

// STEP 4 ----------------------------------------------------------------------
const centroidsStep = () => {
  // for each group of points, calculate the centroid
  if (!centroids) {
    const clusterGroups = {};
    clustered.features.forEach((feature) => {
      if (!clusterGroups.hasOwnProperty(feature.properties.cluster)) {
        clusterGroups[feature.properties.cluster] = [];
      }
      clusterGroups[feature.properties.cluster].push(feature);
    });

    centroids = [];
    Object.keys(clusterGroups).forEach((i) => {
      const features = clusterGroups[i];
      const centroid = turf.centroid({
        type: "FeatureCollection",
        features: features,
      });
      centroids.push(centroid);
    });
  }

  if (!centroidLayer) {
    centroidLayer = L.geoJSON({
      type: "FeatureCollection",
      features: centroids,
    }).addTo(map);
  }
};
const centroidsDestroy = () => {
  clusterGroups = undefined;
  if (centroids) {
    centroids = undefined;
  }
  if (centroidLayer) {
    map.removeLayer(centroidLayer);
    centroidLayer = undefined;
  }
};

// STEP 5 ----------------------------------------------------------------------
const voronoiStep = () => {
  if (!voronoiPolygons) {
    voronoiPolygons = turf.voronoi(
      {
        type: "FeatureCollection",
        features: centroids,
      },
      {
        bbox: polygonBbox,
      }
    );

    voronoiLayer = L.geoJSON(voronoiPolygons).addTo(map);
  }
  if (clusteredPointsLayer) {
    map.removeLayer(clusteredPointsLayer);
  }
};
const voronoiDestroy = () => {
  voronoiPolygons = undefined;
  if (voronoiLayer) {
    map.removeLayer(voronoiLayer);
    voronoiLayer = undefined;
  }
  if (clusteredPointsLayer) {
    clusteredPointsLayer.addTo(map);
  }
};

// STEP 6 ----------------------------------------------------------------------
const voronoiClipStep = () => {
  if (voronoiLayer) {
    map.removeLayer(voronoiLayer);
  }
  if (polygon) {
    map.removeLayer(polygon);
  }
  if (centroidLayer) {
    map.removeLayer(centroidLayer);
  }
  if (!clipped) {
    const clipped = voronoiPolygons.features.map((feature) => {
      return turf.intersect(feature.geometry, polygon.toGeoJSON());
    });

    voronoiClipLayer = L.geoJSON({
      type: "FeatureCollection",
      features: clipped,
    }).addTo(map);
  }
};
const voronoiClipDestroy = () => {
  clipped = false;
  if (voronoiClipLayer) {
    map.removeLayer(voronoiClipLayer);
    voronoiClipLayer = undefined;
  }
  if (voronoiLayer) {
    voronoiLayer.addTo(map);
  }
  if (polygon) {
    polygon.addTo(map);
  }
  if (centroidLayer) {
    centroidLayer.addTo(map);
  }
};

// Array of Steps --------------------------------------------------------------
let steps = [
  {
    run: showPolygon,
    destroy: showPolygonDestroy,
    code: `polygon = L.polygon([...]).addTo(map);`,
  },
  {
    run: randomPointsStep,
    destroy: randomPointsDestroy,
    code: `points = turf.randomPoint(1000, { 
  bbox: polygonBbox 
});

points.features = points.features.filter((feature) => {
  return turf.booleanPointInPolygon(
    feature.geometry.coordinates,
    polygon.toGeoJSON()
  );
});`,
  },
  {
    run: clusterStep,
    destroy: clusterDestroy,
    code: `turf.clustersKmeans(points, {
  numberOfClusters: __clusters__,
});`,
  },
  {
    run: centroidsStep,
    destroy: centroidsDestroy,
    code: `Object.keys(clusterGroups).forEach((i) => {
  const features = clusterGroups[i];
  const centroid = turf.centroid({
    type: "FeatureCollection",
    features: features,
  });
  centroids.push(centroid);
});`,
  },
  {
    run: voronoiStep,
    destroy: voronoiDestroy,
    code: `turf.voronoi(
  {
    type: "FeatureCollection",
    features: centroids,
  },
  {
    bbox: polygonBbox,
  }
);`,
  },
  {
    run: voronoiClipStep,
    destroy: voronoiClipDestroy,
    code: `voronoiPolygons.features.map((feature) => {
  return turf.intersect(feature.geometry, polygon.toGeoJSON());
});`,
  },
];

let clickedOnce = false;
let reRun2 = false;
let reRun3 = false;
let reRun = false;

// Create click handlers:
for (let i = 0; i < steps.length; i++) {
  let selector = `calcite-stepper > *:nth-child(${i + 1})`;
  let step = document.querySelector(selector);
  step.addEventListener("click", () => {
    // Multi-click first step to draw:
    if (i == 0) {
      if (clickedOnce) {
        showDrawPolygon();
        clickedOnce = false;
      } else {
        clickedOnce = true;
      }
    } else {
      clickedOnce = false;
    }

    // Multi-click step 2 to re-run random:
    if (i == 1) {
      if (reRun2) {
        runForStep(0);
        runForStep(1);
      } else {
        reRun2 = true;
      }
    } else {
      reRun2 = false;
    }

    // Multi-click step 3 to change number of clusters:
    if (i == 2) {
      if (reRun3) {
        if (numberOfClusters > 9) {
          numberOfClusters = 3;
        } else {
          numberOfClusters++;
        }
        runForStep(1);
        runForStep(2);
      } else {
        reRun3 = true;
      }
    } else {
      reRun3 = false;
    }

    // Multi-click last step to re-run all:
    if (i == steps.length - 1) {
      if (reRun) {
        runForStep(0);
        runForStep(5);
      } else {
        reRun = true;
      }
    } else {
      reRun = false;
    }

    // Set all the "previous" steps as "complete" (checked icon)
    for (let a = 0; a < steps.length; a++) {
      let s = `calcite-stepper > *:nth-child(${a + 1})`;
      let st = document.querySelector(s);
      if (a < i) {
        st.setAttribute("complete", "");
      } else {
        st.removeAttribute("complete");
      }
    }

    runForStep(i);
  });
}

// Gets called based on which step you click on. Backs up and moves forward
// based on which step you were on and what step you're trying to go to.
const runForStep = (i) => {
  const lastStep = currentStep;
  currentStep = i;

  for (let k = lastStep; k > currentStep; k--) {
    const destroyFunc = steps[k].destroy;
    destroyFunc();
  }

  for (let j = lastStep + 1; j <= currentStep; j++) {
    const func = steps[j].run;
    func();
  }

  // update the code block text:
  let codeBlock = document.querySelector("#codeBlock code");
  codeBlock.innerHTML = steps[i].code.replace("__clusters__", numberOfClusters);
  hljs.highlightBlock(codeBlock);
};

// Kick everything off:
showPolygon();
hljs.initHighlightingOnLoad();
