angular.module('a2.admin.dashboard', [
    'ui.router',
    'ui.bootstrap',
    'a2.utils',
    'a2.services',
    'a2.directives',
    'templates-arbimon2',
    'humane',
    'ui.select',
    'a2.admin.dashboard.data-service',
    'a2.admin.dashboard.plotter-controller',
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise("/dashboard");

    $stateProvider
        .state('dashboard', {
            url: '/dashboard',
            controller:'AdminDashboardCtrl as controller',
            templateUrl: '/admin/dashboard/index.html'
        });
})
.controller('AdminDashboardCtrl', function($scope, $http, $q, $controller) {

    $scope.plots = $controller('AdminDashboardPlotterController', {'$scope':$scope});
    
    $scope.UserStatsExport = function(){
        $http.get('/admin/all-users')
        .success(function(data) {
            download(data)
        });
    }

    $http.get('/admin/dashboard-stats')
        .success(function(data) {
            $scope.newUsers = data.newUsers;
            $scope.newProjects = data.newProjects;
            $scope.Jobs = data.jobsStatus;
            $scope.allUsers = data.allUsers;
            $scope.allSites = data.allSites;
            $scope.allProjects = data.allProjects;
            $scope.newSites = data.newSites;
        });
    
    function convertToCSV(objArray) {
        var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        var str = '';
    
        for (var i = 0; i < array.length; i++) {
            var line = '';
            for (var index in array[i]) {
                if (line != '') line += ','
                line += array[i][index];
            }
            str += line + '\r\n';
        }
        return str;
    }
    
    function exportCSVFile(headers, items, fileTitle) {
        if (headers) {
            items.unshift(headers);
        }
        // Convert Object to JSON
        var jsonObject = JSON.stringify(items);
        var csv = convertToCSV(jsonObject);
        var exportedFilenmae = fileTitle + '.csv' || 'export.csv';
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, exportedFilenmae);
        } else {
            var link = document.createElement("a");
            if (link.download !== undefined) {
                var url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", exportedFilenmae);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }
    
    function download(data){
      var headers = { name: 'Name',email: "Email" };
      var itemsFormatted = [];
      
      // format the data
      data.forEach((item) => {
          itemsFormatted.push({
            name: item.firstname + " " + item.lastname,
            email: item.email
          });
      });
      exportCSVFile(headers, itemsFormatted, 'users');
    }
})
;
