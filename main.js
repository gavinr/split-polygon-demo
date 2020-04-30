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
    ? "#800026"
    : c === 2
    ? "#BD0026"
    : c === 3
    ? "#E31A1C"
    : c === 4
    ? "#FC4E2A"
    : c === 5
    ? "#FD8D3C"
    : c === 6
    ? "#FEB24C"
    : c === 7
    ? "#FED976"
    : "#FFEDA0";
}

let currentStep = 0;
let polygon;
let polygonBbox;
let pointsLayer;
let clusteredPointsLayer;
let points;
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
    .setAttribute("item-subtitle", "");
};

const showPolygon = () => {
  disableAll();
  new L.Draw.Polygon(map, drawControl.options.polygon).enable();
};
const showPolygonDestroy = () => {
  if (polygon) {
    map.removeLayer(polygon);
    polygon = undefined;
  }
  showPolygon();
};

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
  showPolygonDestroy();
};

const clusterStep = () => {
  if (pointsLayer) {
    map.removeLayer(pointsLayer);
  }

  if (!clustered) {
    clustered = turf.clustersKmeans(points, {
      numberOfClusters: 8,
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

let steps = [
  {
    run: showPolygon,
    destroy: showPolygonDestroy,
  },
  {
    run: randomPointsStep,
    destroy: randomPointsDestroy,
  },
  {
    run: clusterStep,
    destroy: clusterDestroy,
  },
  {
    run: centroidsStep,
    destroy: centroidsDestroy,
  },
  {
    run: voronoiStep,
    destroy: voronoiDestroy,
  },
  {
    run: voronoiClipStep,
    destroy: voronoiClipDestroy,
  },
];

for (let i = 0; i < steps.length; i++) {
  let selector = `calcite-stepper > *:nth-child(${i + 1})`;
  let step = document.querySelector(selector);
  step.addEventListener("click", () => {
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
  });
}
showPolygon();
