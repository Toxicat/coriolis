angular.module('app').directive('areaChart', ['$window', function ($window) {


  return {
    restrict: 'A',
    scope:{
      config: '=',
      series: '='
    },
    link: function(scope, element) {
      var series = scope.series,
          config = scope.config,
          labels = config.labels,
          margin = {top: 15, right: 15, bottom: 35, left: 50},
          fmt = d3.format('.3r'),
          fmtLong = d3.format('.2f'),
          // Define Axes
          xAxis = d3.svg.axis().outerTickSize(0).orient("bottom").tickFormat(d3.format('.2r')),
          yAxis = d3.svg.axis().outerTickSize(0).orient("left").tickFormat(fmt),
          x = d3.scale.linear(),
          y = d3.scale.linear();

      // Create chart
      var svg = d3.select(element[0]).append("svg");
      var vis = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Define Area
      var area = d3.svg.area();

      var gradient = vis.append("defs")
        .append("linearGradient")
        .attr("id", "gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "100%")
        .attr("spreadMethod", "pad");
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ff8c0d")
        .attr("stop-opacity", 1);
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#ff3b00")
        .attr("stop-opacity", 1);

      // Create Y Axis SVG Elements
      var yTxt = vis.append("g").attr("class", "y axis")
        .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", -40)
          .attr("dy", ".1em")
          .style("text-anchor", "middle")
          .text(labels.yAxis.title + ' (' + labels.yAxis.unit + ')');
      // Create X Axis SVG Elements
      var xLbl = vis.append("g").attr("class", "x axis");
      var xTxt = xLbl.append("text")
          .attr("y", 30)
          .attr("dy", ".1em")
          .style("text-anchor", "middle")
          .text(labels.xAxis.title + ' (' + labels.xAxis.unit + ')');

      // Create and Add tooltip
      var tip = vis.append("g").style("display", "none");
      tip.append("rect").attr("width","4em").attr("height", "2em").attr("x", "0.5em").attr("y","-1em").attr("class","tip");
      tip.append("circle")
        .attr("class", "marker")
        .attr("r", 4);
      tip.append("text").attr("class", 'label x').attr("y", "-0.1em");
      tip.append("text").attr("class", 'label y').attr("y", '0.7em');

      /**
       * Watch for changes in the series data (mass changes, etc)
       */
      scope.$watchCollection('series', render);
      angular.element($window).bind('orientationchange resize render', render);

      function render() {
        var width = element[0].parentElement.offsetWidth,
            height = width * 0.6,
            w = width - margin.left - margin.right,
            h = height - margin.top - margin.bottom,
            data = [],
            func = series.func;

        if (series.xMax == series.xMin) {
          var yVal = func(series.xMin);
          data.push([ series.xMin, yVal ]);
          data.push([ series.xMin, yVal ]);
          area.x(function(d,i) { return i *  w; }).y0(h).y1(function(d) { return y(d[1]); });
        } else {
          for (var d = series.xMin; d <= series.xMax; d += 1) {
            data.push([ d, func(d) ]);
          }
          area.x(function(d) { return x(d[0]); }).y0(h).y1(function(d) { return y(d[1]); });
        }

        // Update Chart Size
        svg.attr("width", width).attr("height", height);
        // Update domain and scale for axes;
        x.range([0, w]).domain([series.xMin, series.xMax]);
        xAxis.scale(x);
        xLbl.attr("transform", "translate(0," + h + ")");
        xTxt.attr("x", w/2);
        y.range([h, 0]).domain([series.yMin, series.yMax]);
        yAxis.scale(y);
        yTxt.attr("x", -h/2);
        vis.selectAll(".y.axis").call(yAxis);
        vis.selectAll(".x.axis").call(xAxis);

        // Remove existing elements
        vis.selectAll('path.area').remove();

        vis.insert("path",':first-child')   // Area/Path to appear behind everything else
          .datum(data)
          .attr("class", "area")
          .attr('fill', 'url(#gradient)')
          .attr("d", area)
          .on("mouseover", function() { tip.style("display", null); })
          .on("mouseout", function() { tip.style("display", "none"); })
          .on('mousemove', function() {
            var xPos = d3.mouse(this)[0], x0 = x.invert(xPos), y0 = func(x0), flip = (xPos > w * 0.75);
            tip.attr("transform", "translate(" + xPos + "," + y(y0) + ")");
            tip.selectAll('rect').attr("x", flip? '-4.5em' : "0.5em").style("text-anchor", flip? 'end' : 'start');
            tip.selectAll('text.label').attr("x", flip? "-1em" : "1em").style("text-anchor", flip? 'end' : 'start');
            tip.select('text.label.x').text(fmtLong(x0) + ' ' + labels.xAxis.unit);
            tip.select('text.label.y').text(fmtLong(y0) + ' ' + labels.yAxis.unit);
          });
      }

    }
  };
}]);