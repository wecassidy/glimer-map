// Author: Wesley Cassidy
// Date: 2019-05-29

'use strict';

// Random number generator
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// Generate icons lists
var permIcons = [];
var permIconIndex = 0;
var tempIcons = [];
var tempIconIndex = 0;

// Types of markers available in the Google Maps KML Paddle icon set
var colours = ["blu", "grn", "ltblu", "orange", "pink", "purple", "red", "wht", "ylw"];
var shapes = ["blank", "circle", "diamond", "square", "stars"];
shapes.forEach(function (shape, index, list) {
  colours.forEach(function (colour, index, list) {
    permIcons.push({url: "./markers/" + colour + "_" + shape + ".png", scaledSize: {width: 32, height: 32}});
    if (shape !== "blank" && colour !== "pink") { // Small icons aren't available for blank and pink markers
      tempIcons.push("./markers/" + colour + "_" + shape + "_lv.png");
    }
  });
});

function Station(data, checkbox, map, icon) {
  // Extract data to properties
  this.network = data[0];
  this.name = data[1];
  this.start = new Date(data[2]);
  this.end = new Date(data[3]);
  this.pos = {lat: parseFloat(data[4]), lng: parseFloat(data[5])};
  this.elevation = data[6];
  this.frequency = data[7];
  this.permanent = data[8] === "perm";
  this.url1 = data[9];
  this.url2 = data[10];
  this.url3 = data[11];

  // Add a marker to the map
  this.marker = new google.maps.Marker({
    position: this.pos,
    map: map,
    icon: icon
  });

  // Window builder
  var that = this; // Bind this to that so that the object properties are available in the handler (why...)
  this.marker.addListener("click", function() {
    var infoWindow = new google.maps.InfoWindow({
      content: '<table width="500"> \
<tbody><tr> \
<td align="left"> \
<img src="' + that.url1 + '" style="width:185px" valign="top" align="middle"> \
</td> \
<td valign="top" align="right"> \
<p align="left"><b>Network:</b> ' + that.network + '</p> \
<p align="left"><b>Station:</b> ' + that.name + '</p> \
<p align="left"><b>Startdate:</b> ' + that.start.toISOString().substring(0, 10) + '</p> \
<p align="left"><b>Enddate:</b> ' + that.end.toISOString().substring(0, 10) + '</p> \
<p align="left"><b>Latitude:</b> ' + that.pos.lat + '°</p> \
<p align="left"><b>Longitude:</b> ' + that.pos.lng + '°</p> \
<p align="left"><b>Elevation:</b> ' + that.elevation + ' m</p> \
<p align="left"><b>Sampling Frequency:</b> ' + that.frequency + ' Hz</p> \
<p align="left"><b>More information:</b></p> \
<p align="left"><a href="' + that.url1 + '" target="_blank">Stacked radial P receiver function</a></p> \
<p align="left"><a href="' + that.url2 + '" target="_blank">Radial P receiver functions</a></p> \
<p align="left"><a href="' + that.url3 + '" target="_blank">Transverse P receiver functions</a></p> \
</td> \
</tr> \
<tr> \
<td> \
<button class="select-one" type="button" onclick="showOne(\'' + that.network + '\');"> \
Show only this network \
</button> \
</td> \
</tbody> \
</table>'
    });
    infoWindow.open(map, that.marker);
  });

  this.updateVisibility = function () {
    if (!checkbox.checked) {
      that.marker.setMap(null);
    } else if (document.getElementById("use-timeline").checked) {
      var showTime = new Date(document.getElementById("timeline-date").value);

      if (that.start <= showTime && showTime <= that.end) {
        that.marker.setMap(map);
      } else {
        that.marker.setMap(null);
      }
    } else {
      that.marker.setMap(map);
    }
  };
  // The station listens for a change event on the checkbox for this
  // network. As a consequence, the easiest way to update the
  // visibility of all icons in a network is to trigger a change event
  // on the checkbox.
  checkbox.addEventListener("change", this.updateVisibility);
}

// Extract useful elements from the DOM for later
var mapElem = document.getElementById("map");
var netListElem = document.getElementById("network-list");
var timelineElem = document.getElementById("timeline");
var dateInput = document.getElementById("timeline-date");
var dateSlider = document.getElementById("timeline-slider");
var networkChecks = new Map();

// Set initial date
var earliestDate;
var today = new Date();
dateInput.value = today.toISOString().substring(0, 10);

// Important global variables
var map;
var dataTable;
var stations = {};
var networkIcons = {};
var flatStationList = [];

// Show or hide all the pins on the map
function showHideAll(show) {
  networkChecks.forEach(function (checkbox, network, map) {
    checkbox.checked = show;
    checkbox.dispatchEvent(new Event("change"));
  });
}

// Hide the pins from all networks except one
function showOne(showNet) {
  networkChecks.forEach(function (checkbox, network, map) {
    checkbox.checked = network === showNet;
    checkbox.dispatchEvent(new Event("change"));
  });
}

// Show or hide pins based on whether the station was active on the
// currently entered date
function showDate() {
  if (document.getElementById("use-timeline").checked) {
    dateInput.disabled = false;
    dateSlider.disabled = false;
  } else {
    dateInput.disabled = true;
    dateSlider.disabled = true;
  }

  flatStationList.forEach(function (station, index, list) {
    station.updateVisibility();
  });
}

// Sync the date slider with the date input
dateInput.addEventListener("input", function () {
  var newPos = (new Date(this.value).valueOf() - earliestDate.valueOf()) / (earliestDate.valueOf() + (today - earliestDate)) * 100;
  dateSlider.value = newPos;
});

// Sync the date input with the date slider
dateSlider.addEventListener("input", function () {
  var setDate = new Date(earliestDate.valueOf() + (today - earliestDate) * this.value / 100.0);
  dateInput.value = setDate.toISOString().substring(0, 10);
  dateInput.dispatchEvent(new Event("change"));
});

// Callback from when the Google Maps JS API loads
function initMap() {
  map = new google.maps.Map(mapElem, {
    center: {lat: rand(-90, 90), lng: rand(-180, 180)},
    zoom: rand(2, 5)
  });

  // Load stations
  var req = new XMLHttpRequest();
  req.open("GET", "./stations.csv");
  req.addEventListener("load", function () {
    // Process CSV to a 2D array
    dataTable = this.responseText.split("\n");
    dataTable.forEach(function (station, index, list) {
      station = station.split(",");
      list[index] = station;

      if (index == 0) {return;} // Skip the header row

      // Actions to take if we haven't run into this network before
      if (!(station[0] in stations)) {
        stations[station[0]] = []; // Add an entry to the list of stations by network

        // Create the checkbox for the network in the left pane
        var networkSelector = document.createElement("label");
        networkSelector.className = "network-selector";
        networkSelector.setAttribute("for", station[0]);

        var checkbox = document.createElement("input");
        checkbox.id = station[0];
        checkbox.setAttribute("type", "checkbox");
        checkbox.setAttribute("checked", "");
        networkChecks.set(station[0], checkbox); // Add the checkbox to the Map

        var networkText = document.createTextNode(station[0]);

        // Build the element and add it to the DOM
        networkSelector.appendChild(checkbox);
        networkSelector.appendChild(networkText);
        netListElem.appendChild(networkSelector);

        // Set icon for network
        if (station[8] === "perm") {
          networkIcons[station[0]] = permIcons[permIconIndex];
          permIconIndex++;
          permIconIndex %= permIcons.length;
        } else {
          networkIcons[station[0]] = tempIcons[tempIconIndex];
          tempIconIndex++;
          tempIconIndex %= tempIcons.length;
        }
      }

      // Drop pins
      var st = new Station(station, networkChecks.get(station[0]), map, networkIcons[station[0]]);
      stations[st.network].push(st); // Add to list of stations by network
      flatStationList.push(st); // Also add to flat list
    });

    // Find the start date of the earliest station
    earliestDate = flatStationList[0].start;
    flatStationList.forEach(function (station, index, list) {
      if (station.start < earliestDate) {
        earliestDate = station.start;
      }
    });

    // Set limits on date input
    dateInput.min = earliestDate.toISOString().substring(0, 10);
    dateInput.max = today.toISOString().substring(0, 10);

    dataTable.shift(); // Drop the header row
  });
  req.send();
}
