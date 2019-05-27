// Author: Wesley Cassidy
// Date: 2019-05-25

'use strict';

function Station(data, checkbox, map) {
  // Extract data to properties
  this.network = data[0];
  this.name = data[1];
  this.start = new Date(data[2]);
  this.end = new Date(data[3]);
  this.pos = {lat: parseFloat(data[4]), lng: parseFloat(data[5])};
  this.elevation = data[6];
  this.frequency = data[7];
  this.permanent = data[8] == "perm";
  this.url1 = data[10];
  this.url2 = data[11];
  this.url3 = data[12];

  // Add a marker to the map
  this.marker = new google.maps.Marker({
    position: this.pos,
    map: map
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
var networks = [];
var flatStationList = [];

function showHideAll(show) {
  networkChecks.forEach(function (checkbox, network, map) {
    checkbox.checked = show;
    checkbox.dispatchEvent(new Event("change"));
  });
}

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

dateInput.addEventListener("input", function () {
  var newPos = (new Date(this.value).valueOf() - earliestDate.valueOf()) / (earliestDate.valueOf() + (today - earliestDate)) * 100;
  dateSlider.value = newPos;
});

dateSlider.addEventListener("input", function () {
  var setDate = new Date(earliestDate.valueOf() + (today - earliestDate) * this.value / 100.0);
  dateInput.value = setDate.toISOString().substring(0, 10);
  dateInput.dispatchEvent(new Event("change"));
});

function initMap() {
  map = new google.maps.Map(mapElem, {
    center: {lat: 0, lng: 0},
    zoom: 2
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

      // If we're in a new network, add it to the list
      if (!(station[0] in stations)) {
        stations[station[0]] = [];

        var networkSelector = document.createElement("label");
        networkSelector.className = "network-selector";
        networkSelector.setAttribute("for", station[0]);

        var checkbox = document.createElement("input");
        checkbox.id = station[0];
        checkbox.setAttribute("type", "checkbox");
        checkbox.setAttribute("checked", "");
        networkChecks.set(station[0], checkbox);

        var networkText = document.createTextNode(station[0]);

        networkSelector.appendChild(checkbox);
        networkSelector.appendChild(networkText);
        netListElem.appendChild(networkSelector);
      }

      // Drop pins
      var st = new Station(station, networkChecks.get(station[0]), map);
      stations[station[0]].push(st);
      flatStationList.push(st);
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
