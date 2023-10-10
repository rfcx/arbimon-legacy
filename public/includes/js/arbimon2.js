angular.module('a2.admin', ['a2.directives', 'a2.admin.dashboard', 'a2.admin.projects', 'a2.admin.jobs', 'a2.directive.search-bar']).controller('AdminCtrl', ["$scope", "$state", function ($scope, $state) {
  $scope.$state = $state;
}]);
try {
  angular.module("angularytics"); // this throws if GA script is not loaded
} catch (e) {
  console.error("GA not available, likely adblocker", e);

  (function () {
    angular.module('angularytics', []).provider('Angularytics', function () {
      this.setEventHandlers = function () {};

      this.$get = [function () {
        var service = {};

        service.init = function () {};

        return service;
      }];
    }).filter('trackEvent', ['Angularytics', function () {
      return function () {
        return null;
      };
    }]);
  })();
}

var a2 = angular.module('a2.app', ['a2.permissions', 'templates-arbimon2', 'a2.app.dashboard', 'a2.audiodata', 'a2.visualizer', 'a2.analysis', 'a2.citizen-scientist', 'a2.jobs', 'a2.directive.sidenav-bar', 'a2.settings', 'a2.login', 'angularytics', 'ui.router', 'ct.ui.router.extras', 'a2.filters', 'humane', 'a2.googlemaps', 'a2.injected.data', 'a2.directive.search-bar']).run(["$rootScope", "Angularytics", "a2UserPermit", "notify", "$state", function ($rootScope, Angularytics, a2UserPermit, notify, $state) {
  $rootScope.Math = Math; // export math library to angular :-)

  Angularytics.init();
  $rootScope.$on('$stateChangeStart', function (e, to, params) {
    if (to.name.startsWith('visualizer')) {
      document.getElementsByTagName('body')[0].classList.add('visualizer-page');
    } else {
      document.getElementsByTagName('body')[0].classList.remove('visualizer-page');
    } // only check permissions if state have allowAccess


    if (!angular.isFunction(to.allowAccess)) return;
    var allowed = to.allowAccess(a2UserPermit);

    if (allowed === undefined) {
      // if permissions have not loaded go dashboard
      e.preventDefault();
      $state.go('dashboard');
    } else if (allowed === false) {
      e.preventDefault();
      notify.error('You do not have access to this section');
    }
  });
}]).config(["$urlRouterProvider", "$locationProvider", "AngularyticsProvider", "a2GoogleMapsLoaderProvider", "a2InjectedData", function ($urlRouterProvider, $locationProvider, AngularyticsProvider, a2GoogleMapsLoaderProvider, a2InjectedData) {
  a2GoogleMapsLoaderProvider.setAPIKey(a2InjectedData.googleAPI.key);
  AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
  $locationProvider.html5Mode(true);
  $urlRouterProvider.otherwise("/dashboard");
}]).controller('MainCtrl', ["$scope", "$state", "Project", "a2UserPermit", "$window", function ($scope, $state, Project, a2UserPermit, $window) {
  $scope.$state = $state;
  Project.getInfo(function (data) {
    $scope.bioAnalyticsBaseUrl = data.bioAnalyticsBaseUrl;
    $scope.reportsEnabled = data.reports_enabled;
  });

  $scope.getUrlFor = function (page) {
    const projectUrl = Project.getUrl();

    if (page == 'citizen-scientist') {
      return '/citizen-scientist/' + projectUrl + '/';
    } else if (page == 'reports') {
      return $scope.bioAnalyticsBaseUrl + '/' + projectUrl;
    }
  };

  $scope.citizenScientistUser = a2UserPermit.all && a2UserPermit.all.length === 1 && a2UserPermit.all.includes('use citizen scientist interface') && !a2UserPermit.can('delete project') && !a2UserPermit.isSuper();
  $scope.isAppPage = $window.location.pathname.startsWith('/project/');
}]);
var a2 = angular.module('a2.cs-app', ['a2.permissions', 'templates-arbimon2', 'a2.app.dashboard', 'a2.audiodata', 'a2.visualizer', 'a2.analysis', 'a2.citizen-scientist', 'a2.directive.sidenav-bar', 'a2.settings', 'a2.login', 'angularytics', 'ui.router', 'ct.ui.router.extras', 'a2.filters', 'humane', 'a2.googlemaps', 'a2.injected.data', 'a2.directive.search-bar']).run(["$rootScope", "Angularytics", "a2UserPermit", "notify", "$state", function ($rootScope, Angularytics, a2UserPermit, notify, $state) {
  $rootScope.Math = Math; // export math library to angular :-)

  Angularytics.init();
  $rootScope.$on('$stateChangeStart', function (e, to, params) {
    // only check permissions if state have allowAccess
    if (!angular.isFunction(to.allowAccess)) return;
    var allowed = to.allowAccess(a2UserPermit);

    if (allowed === undefined) {
      // if permissions have not loaded go dashboard
      e.preventDefault();
      $state.go('citizen-scientist.patternmatching');
    } else if (allowed === false) {
      e.preventDefault();
      notify.error('You do not have access to this section');
    }
  });
}]).config(["$urlRouterProvider", "$locationProvider", "AngularyticsProvider", "a2GoogleMapsLoaderProvider", "a2InjectedData", function ($urlRouterProvider, $locationProvider, AngularyticsProvider, a2GoogleMapsLoaderProvider, a2InjectedData) {
  a2GoogleMapsLoaderProvider.setAPIKey(a2InjectedData.googleAPI.key);
  AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
  $locationProvider.html5Mode(true);
  $urlRouterProvider.otherwise("/citizen-scientist/patternmatching/");
}]).controller('MainCtrl', ["$scope", "$state", "Project", function ($scope, $state, Project) {
  $scope.$state = $state;
  $scope.onCitizenScientistPage = true;

  $scope.getUrlFor = function (page) {
    if (page == 'citizen-scientist') {
      return '/citizen-scientist/' + Project.getUrl() + '/';
    }
  };
}]);
angular.module('a2.home', ['templates-arbimon2', 'ui.bootstrap', 'a2.utils', 'a2.forms', 'a2.orders', 'a2.login', 'humane', 'angularytics', 'ui.router', 'a2.srv.local-storage', 'a2.filter.time-from-now', 'a2.directive.search-bar', 'ngSanitize']).config(["AngularyticsProvider", "$locationProvider", function (AngularyticsProvider, $locationProvider) {
  AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
}]).run(["Angularytics", function (Angularytics) {
  Angularytics.init();
}]).service('homeSummaryStatsData', function () {
  return [{
    title: 'projects created',
    getData: function ($http) {
      return $http.get('/legacy-api/project/projects-count').then(function (projects) {
        return projects.data;
      });
    }
  }, {
    title: 'recordings uploaded',
    getData: function ($http) {
      return $http.get('/legacy-api/project/recordings-count').then(function (recordings) {
        return recordings.data;
      });
    }
  }, {
    title: 'analyses performed',
    description: 'Number of files processed by pattern matching jobs',
    getData: function ($http) {
      return $http.get('/legacy-api/project/jobs-count').then(function (jobs) {
        return jobs.data;
      });
    }
  }, {
    title: 'species identified',
    getData: function ($http) {
      return $http.get('/legacy-api/project/recordings-species-count').then(function (species) {
        return species.data;
      });
    }
  }];
}).controller('HomeCtrl', ["$http", "$window", "$localStorage", "notify", "a2order", "a2InjectedData", "$scope", "$q", "$injector", "homeSummaryStatsData", function ($http, $window, $localStorage, notify, a2order, a2InjectedData, $scope, $q, $injector, homeSummaryStatsData) {
  $scope.summaryDataLoading = true;
  $scope.list_summary_data = homeSummaryStatsData;
  $scope.summary_data = $scope.list_summary_data.map(function () {
    return [];
  });

  function getSummaryData(summary_item) {
    return $q.resolve(summary_item.getData ? $injector.invoke(summary_item.getData) : []);
  }

  $q.all($scope.list_summary_data.map(getSummaryData)).then(function (allData) {
    $scope.summaryDataLoading = false;
    $scope.summary_data = allData;
  }.bind(this));
  $scope.isExplorePage = $window.location.pathname === '/';

  function getProjectSelectCache() {
    try {
      return JSON.parse($localStorage.getItem('home.project.select.cache')) || {};
    } catch (e) {
      return {};
    }
  }

  function setProjectSelectCache(psCache) {
    try {
      $localStorage.setItem('home.project.select.cache', JSON.stringify(psCache));
    } catch (e) {}
  }

  this.loadProjectList = function () {
    const isFeatured = $scope.isAnonymousGuest || $scope.isExplorePage;
    const isMyProjects = !$scope.isAnonymousGuest && !$scope.isExplorePage;
    var config = {
      params: {
        include_location: true,
        publicTemplates: true
      }
    };

    if (isFeatured) {
      config.params.featured = true;
    }

    if (isMyProjects) {
      config.params.type = 'my';
    }

    var psCache = getProjectSelectCache();
    this.isLoading = true;
    this.projects = [];
    this.highlightedProjects = [];
    $http.get('/legacy-api/user/projectlist', config).success(function (data) {
      data.forEach(function (p) {
        p.lastAccessed = psCache[p.id] || 0;
        var lat = p.lat && p.lat >= -85.0511 && p.lat <= 85.0511 ? p.lat : 37.773972;
        var lon = p.lon && p.lon >= -180 && p.lon <= 180 ? p.lon : -122.431297;
        var zoom = p.lat && p.lon ? 5.33 : 4;
        p.mapUrl = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/" + lon + "," + lat + "," + zoom + ",0,60/274x180?access_token=" + a2InjectedData.mapbox_access_token;
      });
      this.isLoading = false;

      if (isFeatured) {
        this.projects = [];
        this.highlightedProjects = data.filter(function (item) {
          return item.featured === 1;
        });
        this.highlightedProjects.forEach(function (project) {
          project.isLoading = true;
          $http.get('/legacy-api/project/' + project.url + '/templates/count', {
            params: {
              projectTemplates: true
            }
          }).success(function (data) {
            project.templatesTotal = data.count || 0;
            project.isLoading = false;
          });
          $http.get('/legacy-api/project/' + project.url + '/recordings/count').success(function (count) {
            project.recCount = count;
            project.isLoading = false;
          });
          $http.get('/legacy-api/project/' + project.url + '/species-count').success(function (count) {
            project.speciesCount = count || 0;
            project.isLoading = false;
          });
        });
      } else if (isMyProjects) {
        this.highlightedProjects = [];
        this.projects = data;
      }
    }.bind(this)).error(function () {
      this.isLoading = false;
    }.bind(this));
  };

  this.createProject = function () {
    var modalInstance = a2order.createProject({});
    modalInstance.result.then(function (message) {
      if (message) {
        notify.log(message);
      }

      this.loadProjectList();
    }.bind(this));
  };

  this.selectProject = function (project) {
    if (!project.is_enabled) {
      return;
    }

    var psCache = getProjectSelectCache();
    psCache[project.id] = new Date().getTime();
    setProjectSelectCache(psCache);
    $window.location.assign("/project/" + project.url + "/");
  };

  $scope.isAnonymousGuest = true;
  $http.get('/legacy-api/user/info').success(function (data) {
    $scope.isAnonymousGuest = data.isAnonymousGuest;
    this.loadProjectList();
  }.bind(this));

  this.valueShortScale = function (value) {
    if (value && Number(value) > 999999999) {
      value = value.toString().substring(0, 4);
      console.log(value);
      const formattedNumber = numeral(value.toString().substring(0, 4)).format('0,0');
      value = formattedNumber + ' million';
      return value;
    } else {
      return numeral(value).format('0,0');
    } // const formattedNumber = numeral(value).format('0.0a')
    // const firstDecimalDigit = (x) => x.split('.')[1].slice(0, 1)
    // return firstDecimalDigit(formattedNumber) === '0' ? formattedNumber.replace('.0', '') : formattedNumber

  };
}]);
angular.module('a2.login', ['humane', 'ui.bootstrap', 'templates-arbimon2', 'g-recaptcha', 'a2.utils.google-login-button', 'a2.utils.facebook-login-button']).controller('LoginCtrl', ["$scope", "$http", "$window", "$modal", "notify", function ($scope, $http, $window, $modal, notify) {
  $scope.login = function () {
    var path = '/login' + $window.location.search;
    $http.post(path, {
      username: $scope.username,
      password: $scope.password,
      captcha: $scope.captchaResp
    }).success(function (data) {
      if (data.error) {
        notify.error(data.error);

        if (data.captchaNeeded) {
          $scope.showCaptcha = true;
        }

        $scope.resetCaptcha();
        $scope.captchaResp = '';
        return;
      }

      if (data.success) {
        $window.location.assign(data.redirect);
      }
    }).error(function (error) {
      notify.error(error || 'Something went wrong, try again later');
    });
  };

  this.oAuthLogin = function (type, user) {
    var oauthData;

    if (type == 'google') {
      oauthData = {
        type: 'google',
        token: user.getAuthResponse().id_token
      };
    } else if (type == 'facebook') {
      oauthData = {
        type: 'facebook',
        token: user.authResponse.accessToken
      };
    } else {
      return;
    }

    $http.post('/oauth-login' + $window.location.search, oauthData).then(function (response) {
      var data = response.data;

      if (data.error) {
        notify.error(data.error);
      } else if (data.success) {
        $window.location.assign(data.redirect);
      }
    }).catch(function (response) {
      if (response.status == 449) {
        return this.showEnableOAuthModal(oauthData);
      } else {
        notify.error(response.data || 'Something went wrong, try again later');
      }
    }.bind(this));
  };

  this.showEnableOAuthModal = function (oauthData) {
    var modalData = {};
    $modal.open({
      templateUrl: '/common/templates/authorize-enter-credentials-pop-up.html',
      controller: function () {
        this.title = "User Authorization Required";
        this.data = modalData;
        this.oauthType = oauthData.type;
        this.messages = ["Before using " + oauthData.type + " to sign into your account you must first allow it."];
        this.authorizeMessage = "Authorize " + oauthData.type + " sign-in on my account.";
        this.btnOk = "Confirm";
        this.btnCancel = "Cancel";
      },
      controllerAs: 'popup'
    }).result.then(function () {
      if (!modalData.authorized) {
        notify.error("Login authorization canceled.");
      } else {
        $http.post('/oauth-login' + $window.location.search, angular.extend({}, oauthData, {
          authorize: 1,
          username: modalData.username,
          password: modalData.password
        })).then(function (response) {
          var data = response.data;

          if (data.error) {
            notify.error(data.error);
          } else if (data.success) {
            $window.location.assign(data.redirect);
          }
        }).catch(function (response) {
          if (response.status == 449) {
            return this.showEnableOAuthModal(oauthData);
          } else {
            notify.error(response.data || 'Something went wrong, try again later');
          }
        }.bind(this));
      }
    });
  };
}]).controller('RedirectToLoginCtrl', ["$scope", "$window", function ($scope, $window) {
  var redirect = $window.location.pathname + $window.location.search + $window.location.hash;
  $scope.loginUrl = "/login?redirect=" + encodeURIComponent(redirect);
}]);
angular.module('a2.orders', ['a2.orders.orders', 'a2.orders.order-utils', 'a2.orders.create-project', 'a2.orders.change-project-plan', 'a2.orders.order-summary', 'a2.orders.plan-selection', 'a2.orders.shipping-form', 'a2.orders.process-order', 'a2.orders.directives.plan-capacity', 'a2.orders.directives.tier-select' // 'ui.bootstrap',
// 'humane',
// 'a2.directives',
// 'a2.services',
]);
angular.module('a2.register', ['a2.forms', 'a2.directives', 'ui.bootstrap', 'angularytics', 'g-recaptcha', 'humane']).config(["AngularyticsProvider", function (AngularyticsProvider) {
  AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
}]).run(["Angularytics", function (Angularytics) {
  Angularytics.init();
}]).controller('UserRegisterCtrl', ["$scope", "$modal", "$http", "$timeout", "$interval", "notify", function ($scope, $modal, $http, $timeout, $interval, notify) {
  var captchaResp = '';

  $scope.testUsername = function () {
    $scope.usernameOk = '';
    $scope.usernameErr = '';

    if ($scope.testUserTimeout) {
      $timeout.cancel($scope.testUserTimeout);
    }

    if ($scope.regis.username.$error.required) {
      return;
    } else if ($scope.regis.username.$error.pattern) {
      $scope.usernameErr = "Username must be at least 4 characters long " + "and can only contain alphanumeric characters," + " dash(-), underscore(_) and dot(.).";
      return;
    }

    $scope.testUserTimeout = $timeout(function () {
      $http.get('/legacy-api/login_available', {
        params: {
          username: $scope.user.username
        }
      }).success(function (data) {
        if (data.available) {
          $scope.usernameOk = $scope.user.username + " is available";
        } else {
          $scope.usernameErr = $scope.user.username + " is not available";
        }
      });
    }, 1000);
  };

  $scope.testEmail = function () {
    $scope.emailOk = '';
    $scope.emailErr = '';

    if ($scope.testEmailTimeout) {
      $timeout.cancel($scope.testEmailTimeout);
    }

    if ($scope.regis.email.$error.required) {
      return;
    } else if ($scope.regis.email.$error.email) {
      $scope.emailErr = "Invalid email";
      return;
    }

    $scope.testEmailTimeout = $timeout(function () {
      $http.get('/legacy-api/email_available', {
        params: {
          email: $scope.user.email
        }
      }).success(function (data) {
        if (data.available) {
          $scope.emailOk = $scope.user.email + " is available";
        } else {
          if (data.invalid) {
            $scope.emailErr = $scope.user.email + " is not a valid address";
          } else {
            $scope.emailErr = $scope.user.email + " is not available";
          }
        }
      });
    }, 1000);
  };

  $scope.register = function ($event) {
    if (!$scope.passResult.valid) {
      notify.error($scope.passResult.msg);
    } else if ($scope.usernameErr) {
      notify.error($scope.usernameErr);
    } else if ($scope.emailErr) {
      notify.error($scope.emailErr);
    } else if (!$scope.terms_accepted) {
      notify.log('To register you must agree with our terms of service');
    } else if (!$scope.captchaResp && !$scope.captchaNotNeeded) {
      notify.log('Please complete the captcha');
    } else {
      $scope.loading = true;
      $http.post('/register', {
        user: $scope.user,
        captcha: $scope.captchaResp,
        newsletter: $scope.newsletter
      }).success(function (data) {
        $scope.loading = false;

        if (data.success) {
          $scope.completed = true;
        }
      }).error(function (data) {
        $scope.loading = false;

        if (data.error) {
          $scope.resetCaptcha();
          $scope.captchaResp = '';
          return notify.error(data.error);
        }

        notify.error("something went wrong, please try again later");
      });
    }
  };
}]);
angular.module('a2.reset-password', ['a2.directives', 'a2.forms', 'humane']).controller('ResetPassCtrl', ["$scope", "$http", "$window", "notify", function ($scope, $http, $window, notify) {
  $scope.changePassword = function () {
    if (!$scope.passResult.valid) {
      notify.error($scope.passResult.msg);
    }

    var path = $window.location.pathname;
    $http.post(path, {
      password: $scope.password
    }).success(function (data) {
      $scope.completed = true;
    });
  };
}]).controller('ResetRequestCtrl', ["$scope", "$http", "notify", function ($scope, $http, notify) {
  $scope.request = function () {
    $scope.loading = true;
    $http.post('/forgot_request', {
      email: $scope.email
    }).success(function (data) {
      $scope.loading = false;

      if (data.error) {
        return notify.error(data.error);
      }

      $scope.requestComplete = true;
    });
  };
}]);
angular.module('a2.user-settings', ['templates-arbimon2', 'a2.forms', 'ui.bootstrap', 'humane', 'angularytics']).config(["AngularyticsProvider", function (AngularyticsProvider) {
  AngularyticsProvider.setEventHandlers(['Console', 'GoogleUniversal']);
}]).run(["Angularytics", function (Angularytics) {
  Angularytics.init();
}]).controller('UserSettingsCtrl', ["$scope", "$modal", "$http", "notify", function ($scope, $modal, $http, notify) {
  this.data = {};
  $http.get('/legacy-api/user/info').then(function (response) {
    $scope.user = response.data;
    this.user = response.data;
    this.reset();
  }.bind(this));

  this.reset = function () {
    this.data = angular.copy(this.user);
  };

  this.save = function () {
    var data = this.data;
    return $http.post('/legacy-api/user/update', {
      userData: {
        name: data.name,
        lastname: data.lastname,
        oauth: data.oauth
      }
    }).then(function (response) {
      if (response.data.error) {
        notify.error(response.data.error);
      } else {
        notify.log(response.data.message);
      }
    }).catch(function (err) {
      console.log("err", err);
      notify.serverError();
    });
  };
}]);
var a2 = angular.module('a2.visualizer-app', ['a2.permissions', 'templates-arbimon2', 'a2.visualizer', 'angularytics', 'ui.router', 'ct.ui.router.extras', 'a2.filters', 'humane', 'a2.googlemaps', 'a2.injected.data', 'a2.directive.search-bar']).run(["$rootScope", "Angularytics", "a2UserPermit", "notify", "$state", function ($rootScope, Angularytics, a2UserPermit, notify, $state) {
  $rootScope.Math = Math; // export math library to angular :-)

  Angularytics.init();
  $rootScope.$on('$stateChangeStart', function (e, to, params) {
    // only check permissions if state have allowAccess
    if (!angular.isFunction(to.allowAccess)) return;
    var allowed = to.allowAccess(a2UserPermit);

    if (!allowed) {
      // if permissions have not loaded go dashboard
      e.preventDefault();
      notify.error('You do not have access to this section');
    }
  });
}]).config(["$urlRouterProvider", "$locationProvider", "AngularyticsProvider", "a2GoogleMapsLoaderProvider", "a2InjectedData", function ($urlRouterProvider, $locationProvider, AngularyticsProvider, a2GoogleMapsLoaderProvider, a2InjectedData) {
  a2GoogleMapsLoaderProvider.setAPIKey(a2InjectedData.googleAPI.key);
  AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
  $locationProvider.html5Mode(true);
  $urlRouterProvider.otherwise("/visualizer");
}]).controller('MainCtrl', ["$scope", "$state", "Project", "$http", "$window", function ($scope, $state, Project, $http, $window) {
  $scope.$state = $state;

  $scope.getUrlFor = function (page) {
    if (page == 'visualizer') {
      return '/visualizer/' + Project.getUrl() + '/';
    }
  };
}]);
angular.module('a2.srv.api', []).factory('a2APIServiceClass', ["$location", "$q", "$http", function ($location, $q, $http) {
  var a2APIServiceClass = function (prefix) {
    this.prefix = prefix;
  };

  function returnData(response) {
    return response.data;
  }

  a2APIServiceClass.prototype = {
    getUrl: function (apiRoute) {
      return this.prefix + apiRoute;
    },
    get: function (apiRoute, params) {
      return $q.when($http.get(this.prefix + apiRoute, params)).then(returnData);
    },
    post: function (apiRoute, data) {
      return $q.when($http.post(this.prefix + apiRoute, data)).then(returnData);
    },
    delete: function (apiRoute, data) {
      return $q.when($http.delete(this.prefix + apiRoute)).then(returnData);
    },
    put: function (apiRoute, data) {
      return $q.when($http.put(this.prefix + apiRoute, data)).then(returnData);
    }
  };
  return a2APIServiceClass;
}]).factory('a2APIService', ["$location", "$q", "a2APIServiceClass", function ($location, $q, a2APIServiceClass) {
  var nrm = /\/?(project|citizen-scientist|visualizer)\/([\w\_\-]+)/.exec($location.absUrl());
  var projectName = nrm ? nrm[2] : '';
  var apiURLPrefix = '/legacy-api/project/' + projectName;

  function returnData(response) {
    return response.data;
  }

  var a2APIService = new a2APIServiceClass(apiURLPrefix);
  a2APIService.api = new a2APIServiceClass('/legacy-api');
  a2APIService.project = new a2APIServiceClass('/project/' + projectName);

  a2APIService.getProjectName = function () {
    return projectName;
  };

  return a2APIService;
}]);
angular.module('a2.service.audio-event-detection', ['a2.srv.api']).factory('AudioEventDetectionService', ["a2APIService", function (a2APIService) {
  var AudioEventDetectionService = {
    getList: function () {
      return a2APIService.get('/audio-event-detections/');
    },
    getAlgorithmsList: function () {
      return a2APIService.get('/audio-event-detections/algorithms');
    },
    getStatisticsList: function () {
      return a2APIService.get('/audio-event-detections/statistics');
    },
    getDataStatisticsList: function () {
      return a2APIService.get('/audio-event-detections/data/statistics');
    },
    getDataAggregatesList: function () {
      return a2APIService.get('/audio-event-detections/data/aggregates');
    },
    getDataFor: function (aed, x, y, z) {
      var args = [];
      return a2APIService.get('/audio-event-detections/data/' + [aed, x.statistic, y.statistic, z.statistic].map(encodeURIComponent).join('/') + '?' + args.join('&'));
    },
    savePlotFor: function (aed, x, y, z) {
      var params = {
        x: x.statistic,
        y: y.statistic,
        z: z.statistic
      };
      return a2APIService.post('/audio-event-detections/default-plot/' + [aed].map(encodeURIComponent).join('/'), params);
    },
    new: function (aed) {
      aed = aed || {};
      var params = {
        name: aed.name || aed.defaultName,
        algorithm: aed.algorithm.id,
        parameters: aed.parameters,
        statistics: aed.statistics.map(function (statistic) {
          return statistic.id;
        }),
        playlist: aed.playlist.id
      };
      return a2APIService.post('/audio-event-detections/new', params);
    }
  };
  return AudioEventDetectionService;
}]);
angular.module('a2.srv.audio-event-detections-clustering', ['a2.srv.project', 'humane']).factory('a2AudioEventDetectionsClustering', ["$http", "Project", "notify", function ($http, Project, notify) {
  return {
    list: function (opts, callback) {
      const config = {
        params: opts
      };
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering', config).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    count: function () {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/total-recordings').then(function (response) {
        return response.data;
      });
    },
    create: function (data) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/new', data).then(function (response) {
        return response.data;
      });
    },
    validate: function (opts) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/validate', opts).then(function (response) {
        return response.data;
      });
    },
    unvalidate: function (opts) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/unvalidate', opts).then(function (response) {
        return response.data;
      });
    },
    delete: function (jobId) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/audio-event-detections-clustering/' + jobId + '/remove').then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    }
  };
}]);
angular.module('a2.srv.citizen-scientist-admin', ['a2.srv.api']).factory('a2CitizenScientistAdminService', ["a2APIService", "Project", "notify", function (a2APIService, Project, notify) {
  return {
    getClassificationStats: function (speciesId) {
      return a2APIService.get('/citizen-scientist/stats/classification' + (speciesId ? '/' + speciesId : '')).catch(notify.serverError);
    },
    getUserStats: function (userId) {
      return a2APIService.get('/citizen-scientist/stats/user' + (userId ? '/' + userId : '')).catch(notify.serverError);
    },
    getUserStatsExportUrl: function () {
      return '/legacy-api/project/' + Project.getUrl() + '/citizen-scientist/stats/export/user-stats.csv';
    },
    getCSExportUrl: function (pattern_matching_id, per_user) {
      var filename = per_user ? 'export-per-user.csv' : 'export.csv';
      return '/legacy-api/project/' + Project.getUrl() + '/citizen-scientist/pattern-matchings/' + pattern_matching_id + '/' + filename;
    },
    getSettings: function () {
      return a2APIService.get('/citizen-scientist/settings').catch(notify.serverError);
    },
    setSettings: function (settings) {
      return a2APIService.post('/citizen-scientist/settings', settings).catch(notify.serverError);
    }
  };
}]);
angular.module('a2.srv.citizen-scientist-expert', ['a2.srv.api']).factory('a2CitizenScientistExpertService', ["a2APIService", "Project", "notify", function (a2APIService, Project, notify) {
  return {
    getPatternMatchings: function () {
      return a2APIService.get('/citizen-scientist/pattern-matchings/expert').catch(notify.serverError);
    },
    getPatternMatchingDetailsFor: function (patternMatchingId) {
      return a2APIService.get('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/expert/details').catch(notify.serverError);
    },
    getPatternMatchingRoisFor: function (patternMatchingId, limit, offset, options) {
      var query = Object.keys(options || {}).map(function (option) {
        return option + '=' + encodeURIComponent(options[option]);
      }).join('&');
      return a2APIService.get('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/expert-rois/' + (offset || 0) + '_' + (limit || 0) + (query ? '?' + query : '')).catch(notify.serverError);
    },
    validatePatternMatchingRois: function (patternMatchingId, rois, validation) {
      return a2APIService.post('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/expert-validate', {
        rois: rois,
        validation: validation
      }).catch(notify.serverError);
    },
    getCSExportUrl: function (options) {
      options = options || {};
      return '/legacy-api/project/' + Project.getUrl() + '/citizen-scientist/pattern-matchings/' + (options.patternMatching | 0) + '/export.csv';
    }
  };
}]);
angular.module('a2.srv.citizen-scientist', ['a2.srv.api']).factory('a2CitizenScientistService', ["a2APIService", "notify", function (a2APIService, notify) {
  return {
    getMyStats: function (userId) {
      return a2APIService.get('/citizen-scientist/stats/mine').catch(notify.serverError);
    },
    getPatternMatchings: function () {
      return a2APIService.get('/citizen-scientist/pattern-matchings').catch(notify.serverError);
    },
    getPatternMatchingDetailsFor: function (patternMatchingId) {
      return a2APIService.get('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/details').catch(notify.serverError);
    },
    getPatternMatchingRoisFor: function (patternMatchingId, limit, offset) {
      return a2APIService.get('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/rois/' + (offset || 0) + '_' + (limit || 0)).catch(notify.serverError);
    },
    validatePatternMatchingRois: function (patternMatchingId, rois, validation) {
      return a2APIService.post('/citizen-scientist/pattern-matchings/' + patternMatchingId + '/validate', {
        rois: rois,
        validation: validation
      }).catch(notify.serverError);
    }
  };
}]);
angular.module('a2.srv.classi', ['a2.srv.project', 'humane']).factory('a2Classi', ["$http", "Project", "notify", function ($http, Project, notify) {
  var saveData = null;
  return {
    saveState: function (data) {
      saveData = data;
    },
    getState: function () {
      return saveData;
    },
    list: function (callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/classifications').then(function (response) {
        if (callback) {
          callback(response.data);
        }

        return response.data;
      }).catch(notify.serverError);
    },
    getDetails: function (classificationId, callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/classifications/' + classificationId).success(callback).error(notify.serverError);
    },
    getResultDetails: function (classificationId, first, limit, callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/classifications/' + classificationId + '/more/' + first + '/' + limit).then(function (response) {
        if (callback) {
          callback(response.data);
        }

        return response.data;
      }).catch(notify.serverError);
    },
    getRecVector: function (classificationId, recId) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/classifications/' + classificationId + '/vector/' + recId);
    },
    create: function (classificationData, callback) {
      $http.post('/legacy-api/project/' + Project.getUrl() + '/classifications/new', classificationData).success(callback).error(notify.serverError);
    },
    delete: function (classificationId, callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/classifications/' + classificationId + '/delete').success(callback).error(notify.serverError);
    }
  };
}]);
angular.module('a2.srv.clustering-jobs', ['a2.srv.project', 'humane']).factory('a2ClusteringJobs', ["$http", "Project", "notify", "$httpParamSerializer", function ($http, Project, notify, $httpParamSerializer) {
  return {
    list: function (opts) {
      const config = {
        params: opts
      };
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs', config).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    getJobDetails: function (clusteringJobId) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + clusteringJobId + '/job-details').then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    getClusteringDetails: function (opts) {
      var config = {
        params: opts
      };
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + opts.job_id + '/clustering-details', config).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    getRoisDetails: function (opts) {
      var params = {};

      if (opts.aed) {
        params.aed = opts.aed;
      }

      if (opts.rec_id) {
        params.rec_id = opts.rec_id;
      }

      if (opts.search && opts.search == 'per_site') {
        params.perSite = true;
      } else if (opts.search && opts.search == 'per_date') {
        params.perDate = true;
      } else params.all = true;

      return $http.post('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + opts.jobId + '/rois-details', params).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    exportClusteringROIs: function (opts) {
      const config = {
        params: opts
      };
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + opts.jobId + '/rois-export', config).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    getAudioUrlFor: function (recId, aedId) {
      return '/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + recId + '/audio/' + aedId;
    },
    audioEventDetections: function (opts) {
      var config = {
        params: {}
      };

      if (opts.completed) {
        config.params.completed = opts.completed;
      }

      return $http.get('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/audio-event-detections', config).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    create: function (data) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/new', data).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    delete: function (clusteringJobId) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/clustering-jobs/' + clusteringJobId + '/remove').then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    }
  };
}]);
angular.module('a2.srv.cnn', ['a2.srv.project', 'humane']).factory('a2CNN', ["$q", "$http", "Project", "notify", function ($q, $http, Project, notify) {
  var saveData = null;
  return {
    listROIs: function (job_id, limit, offset, species_id, site_id, search, callback) {
      if (!limit) {
        var limit = 100;
      }

      if (!offset) {
        var offset = 0;
      }

      if (!species_id) {
        species_id = 0;
      }

      if (!site_id) {
        site_id = 0;
      }

      if (!search) {
        search = "all";
      }

      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/rois/' + job_id + "/" + species_id + "/" + site_id + "/" + search + "/" + offset + "_" + limit).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    listROIsBySpecies: function (job_id, species_id, callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/roisBySpecies/' + job_id + '/' + species_id).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    listResults: function (job_id, callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/results/' + job_id).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    listModels: function (callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/models').then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    saveState: function (data) {
      saveData = data;
    },
    getState: function () {
      return saveData;
    },
    list: function (callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn').then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    getDetailsFor: function (cnnId) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/details').then(function (response) {
        return response.data;
      });
    },
    getRoisFor: function (cnnId, limit, offset) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/rois/' + (offset || 0) + '_' + (limit || 0)).then(function (response) {
        return response.data;
      });
    },
    countROIsBySpecies: function (cnnId) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/countROIsBySpecies');
    },
    countROIsBySites: function (cnnId) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/countROIsBySites');
    },
    countROIsBySpeciesSites: function (cnnId, options) {
      var search = "all";

      if (options.search) {
        search = options.search;
      }

      return $http.get('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/countROIsBySpeciesSites/' + search);
    },
    getExportUrl: function (params) {
      return '/legacy-api/project/' + Project.getUrl() + '/cnn/' + params.cnnId + '/rois.csv';
    },
    getAudioUrlFor: function (roi) {
      return '/legacy-api/project/' + Project.getUrl() + '/cnn/' + roi.job_id + '/audio/' + roi.cnn_result_roi_id;
    },
    validateRois: function (cnnId, rois, validation) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/validate', {
        rois: rois,
        validation: validation
      }).then(function (response) {
        return response.data;
      });
    },
    create: function (data) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/cnn/new', data).then(function (response) {
        return response.data;
      });
    },
    delete: function (cnnId) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/cnn/' + cnnId + '/remove').then(function (response) {
        return response.data;
      });
    }
  };
}]);
angular.module('a2.service.download-resource', []).service('$downloadResource', ["$window", function ($window) {
  return function $downloadResource(resource_url) {
    var a = angular.element('<a></a>').attr('target', '_blank').attr('href', resource_url).appendTo('body');
    $window.setTimeout(function () {
      a[0].click();
      a.remove();
    }, 0);
  };
}]);
angular.module('a2.services', ['a2.srv.classi', 'a2.srv.models', 'a2.srv.playlists', 'a2.srv.project', 'a2.srv.sites', 'a2.srv.soundscapes', 'a2.srv.species', 'a2.srv.users', 'a2.srv.training-sets', 'a2.srv.templates', 'a2.srv.audio-event-detections-clustering', 'a2.srv.clustering-jobs']);
angular.module('a2.srv.local-storage', []).service('$localStorage', ["$window", function ($window) {
  return {
    getItem: function (item) {
      if ($window.localStorage) {
        return $window.localStorage.getItem(item);
      }
    },
    setItem: function (item, value) {
      if ($window.localStorage) {
        $window.localStorage.setItem(item, value);
      }
    }
  };
}]);
angular.module('a2.srv.models', ['a2.srv.project', 'humane']).factory('a2Models', ["$http", "Project", "notify", function ($http, Project, notify) {
  var saveData = null;
  var openedModel = false;
  return {
    modelState: function (s) {
      openedModel = s;
    },
    isModelOpen: function () {
      return openedModel;
    },
    saveState: function (data) {
      saveData = data;
    },
    getState: function () {
      return saveData;
    },
    list: function (callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/models').success(callback).error(notify.serverError);
    },
    getFormInfo: function (callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/models/forminfo').success(callback).error(notify.serverError);
    },
    findById: function (modelId) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/models/' + modelId);
    },
    create: function (modelData) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/models/new', modelData);
    },
    delete: function (modelId, callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + "/delete").success(callback).error(notify.serverError);
    },
    getValidationResults: function (modelId, callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + '/validation-list/').success(callback).error(notify.serverError);
    },
    getRecVector: function (modelId, recId, callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/models/' + modelId + '/training-vector/' + recId);
    },
    setThreshold: function (modelId, thresholdValue) {
      var data = {
        m: modelId,
        t: thresholdValue
      };
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/models/savethreshold', data);
    }
  };
}]);
angular.module('a2.srv.news', ['a2.srv.api']).service('a2NewsService', ["$q", "a2APIService", function ($q, a2APIService) {
  return {
    loadPage: function (index) {
      return a2APIService.api.get('/user/feed/' + (index | 0));
    },
    loadFormats: function () {
      return a2APIService.api.get('/user/feed/formats');
    }
  };
}]);
angular.module('a2.srv.open-modal', ['ui.bootstrap.modal']).provider('$openModal', function () {
  var $openModalProvider = {
    defs: {},
    define: function (modalName, modalDef) {
      $openModalProvider.defs[modalName] = angular.extend({}, modalDef);
    },
    $get: ["$modal", function ($modal) {
      return function $openModal(modalName, overrides) {
        var options = angular.extend({}, $openModalProvider.defs[modalName]);

        if (overrides) {
          if (overrides.resolve) {
            console.log("overrides.resolve", overrides.resolve);
            options.resolve = angular.extend(options.resolve, overrides.resolve);
            console.log("options.resolve", options.resolve);
            delete overrides.resolve;
          }

          options = angular.extend(options, overrides);
        }

        return $modal.open(options);
      };
    }]
  };
  return $openModalProvider;
});
angular.module('a2.srv.patternmatching', ['a2.srv.project', 'humane']).factory('a2PatternMatching', ["$q", "$http", "a2APIService", "Project", "notify", function ($q, $http, a2APIService, Project, notify) {
  var saveData = null;
  return {
    saveState: function (data) {
      saveData = data;
    },
    getState: function () {
      return saveData;
    },
    list: function (opts, callback) {
      const config = {
        params: opts
      };
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/pattern-matchings', config).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    getDetailsFor: function (patternMatchingId) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/details').then(function (response) {
        return response.data;
      });
    },
    getPatternMatchingsTotal: function (callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/count').success(function (data) {
        callback(data);
      });
    },
    getRoisFor: function (patternMatchingId, limit, offset, options) {
      var query = Object.keys(options || {}).map(function (option) {
        return option + '=' + encodeURIComponent(options[option]);
      }).join('&');
      return a2APIService.get('/pattern-matchings/' + patternMatchingId + '/rois/' + (offset || 0) + '_' + (limit || 0) + (query ? '?' + query : '')).catch(notify.serverError);
    },
    getSitesListFor: function (patternMatchingId, options) {
      var query = Object.keys(options || {}).map(function (option) {
        return option + '=' + encodeURIComponent(options[option]);
      }).join('&');
      return a2APIService.get('/pattern-matchings/' + patternMatchingId + '/site-index' + (query ? '?' + query : '')).catch(notify.serverError);
    },
    getExportUrl: function (params) {
      return '/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/' + params.patternMatching + '/' + params.fileName + '.csv';
    },
    getAudioUrlFor: function (roi) {
      const ext = '.mp3';
      return '/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/' + roi.pattern_matching_id + '/audio/' + roi.id + ext;
    },
    validateRois: function (patternMatchingId, rois, validation, cls) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/validate', {
        rois: rois,
        validation: validation,
        cls: cls
      }).then(function (response) {
        return response.data;
      });
    },
    create: function (data) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/new', data).then(function (response) {
        return response.data;
      });
    },
    update: function (patternMatchingId, data) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/update', data).then(function (response) {
        return response.data;
      });
    },
    delete: function (patternMatchingId) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/pattern-matchings/' + patternMatchingId + '/remove').then(function (response) {
        return response.data;
      });
    }
  };
}]);
angular.module('a2.srv.playlists', ['a2.srv.project']).factory('a2Playlists', ["Project", "a2APIService", "$rootScope", "$http", function (Project, a2APIService, $rootScope, $http) {
  var projectName = Project.getUrl();
  return {
    getList: function (options) {
      if (options) {
        options = {
          params: options
        };
      }

      if (options && options.filterPlaylistLimit) {
        options.params.filterPlaylistLimit = options.filterPlaylistLimit;
      }

      return $http.get('/legacy-api/project/' + projectName + '/playlists', options).then(function (response) {
        return response.data;
      });
    },
    create: function (playlistParams, callback) {
      $http.post('/legacy-api/project/' + projectName + '/playlists/create', playlistParams).success(function (data) {
        $rootScope.$emit('a2Playlists-invalidate-list');
        callback(data);
      });
    },
    combine: function (expression) {
      return a2APIService.post('/playlists/combine', expression).then(function (data) {
        $rootScope.$emit('a2Playlists-invalidate-list');
        return data;
      });
    },
    getRecordingPosition: function (playlist, recording, callback) {
      var r = $http.get('/legacy-api/project/' + projectName + '/playlists/' + playlist + '/' + recording + '/position');

      if (callback) {
        r.success(callback);
      }

      return r;
    },
    // addData: function(playlist, tset_data, callback) {
    //     var projectName = Project.getUrl();
    //     $http.post('/legacy-api/project/'+projectName+'/playlists/add-data/'+playlist, tset_data).success(function(data) {
    //         callback(data);
    //     });
    // },
    getPreviousRecording: function (playlist, recording, callback) {
      return $http.get('/legacy-api/project/' + projectName + '/playlists/' + playlist + '/' + recording + '/previous').success(function (data) {
        callback(data);
      });
    },
    getNextRecording: function (playlist, recording, callback) {
      return $http.get('/legacy-api/project/' + projectName + '/playlists/' + playlist + '/' + recording + '/next').success(function (data) {
        callback(data);
      });
    },
    rename: function (playlist, callback) {
      $http.post('/legacy-api/project/' + projectName + '/playlists/rename', playlist).success(function (data) {
        $rootScope.$emit('a2Playlists-invalidate-list');
        callback(data);
      });
    },
    remove: function (playlistIds, callback) {
      $http.post('/legacy-api/project/' + projectName + '/playlists/delete', {
        playlists: playlistIds
      }).success(function (data) {
        $rootScope.$emit('a2Playlists-invalidate-list');
        callback(data);
      });
    },
    getInfo: function (playlist, callback) {
      $http({
        method: 'GET',
        url: '/legacy-api/project/' + projectName + '/playlists/info/' + playlist
      }).success(function (data) {
        callback(data);
      });
    },
    getData: function (playlist, params, callback) {
      $http.post('/legacy-api/project/' + projectName + '/playlists/' + playlist, params).success(function (data) {
        callback(data);
      });
    },
    $on: function (event, handler) {
      return $rootScope.$on('a2Playlists-' + event, handler);
    },
    attachAedToPlaylist: function (opts, callback) {
      $http.post('/legacy-api/project/' + projectName + '/playlists/' + opts.playlist_id + '/aed', {
        aed: opts.aed
      }).success(function (data) {
        callback(data);
      });
    }
  };
}]);
angular.module('a2.srv.project', ['a2.srv.api']).factory('Project', ["$location", "$http", "$q", "$httpParamSerializer", "a2APIService", "notify", function ($location, $http, $q, $httpParamSerializer, a2APIService, notify) {
  var nameRe = /\/?(project|citizen-scientist|visualizer)\/([\w\_\-]+)/;
  var nrm = nameRe.exec($location.absUrl());
  var url = nrm ? nrm[2] : '';
  return {
    getUrl: function () {
      return url;
    },
    getInfo: function (callback) {
      $http.get('/legacy-api/project/' + url + '/info').success(function (data) {
        callback(data);
      });
    },
    getProjectById: function (projectId, callback) {
      var config = {
        params: {}
      };

      if (projectId) {
        config.params.project_id = projectId;
      }

      $http.get('/legacy-api/project/' + url + '/info/source-project', config).success(function (data) {
        callback(data);
      });
    },
    updateInfo: function (info, callback) {
      $http.post('/legacy-api/project/' + url + '/info/update', info).success(function (data) {
        callback(null, data);
      }).error(function (err) {
        callback(err);
      });
    },
    getUsage: function () {
      return $http.get('/legacy-api/project/' + url + '/usage');
    },
    getSites: function (options, callback) {
      if (typeof options == 'function') {
        callback = options;
        options = {};
      }

      return $q.when($http.get('/legacy-api/project/' + url + '/sites', {
        params: options
      })).then(function (response) {
        if (callback) {
          callback(response.data);
        }

        return response.data;
      });
    },
    getClasses: function (options, callback) {
      if (typeof options == 'function') {
        callback = options;
        options = {};
      }

      return $q.when($http.get('/legacy-api/project/' + url + '/classes', {
        params: options
      })).then(function (response) {
        if (callback) {
          callback(response.data);
        }

        return response.data;
      });
    },
    getRecs: function (query, callback) {
      if (typeof query === "function") {
        callback = query;
        query = {};
      }

      if (query && query.tags) {
        query['tags[]'] = query.tags.flat();
        delete query.tags;
      }

      $http.get('/legacy-api/project/' + url + '/recordings/search', {
        params: query
      }).success(function (data) {
        callback(data);
      });
    },
    getRecCounts: function (query) {
      if (query && query.project_url) {
        delete query.project_url;
      }

      return a2APIService.get('/recordings/search-count', {
        params: query || {}
      });
    },
    getRecordingData: function (filters, projection) {
      if (filters.tags) {
        filters.tags = filters.tags.flat();
      }

      if (filters.range) {
        filters.range.from = moment(filters.range.from).format('YYYY-MM-DD') + 'T00:00:00.000Z';
        filters.range.to = moment(filters.range.to).format('YYYY-MM-DD') + 'T23:59:59.999Z';
      }

      var params = {
        filters: filters,
        show: projection
      };
      const getUrl = '/legacy-api/project/' + url + '/recordings/' + (projection && projection.species ? 'occupancy-models-export' : projection && projection.grouped ? 'grouped-detections-export' : 'recordings-export');
      return $http.post(getUrl, params).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
      ;
    },
    getSitesExportUrl: function () {
      return '/legacy-api/project/' + url + '/sites-export.csv';
    },
    getRecTotalQty: function (callback) {
      return a2APIService.get('/recordings/count').then(function (data) {
        if (callback) {
          callback(data);
        }

        return data;
      });
    },
    getProjectTotalSpecies: function (projectId, callback) {
      $http.get('/legacy-api/project/' + url + '/species-count', {
        project_id: projectId
      }).success(function (count) {
        callback(count);
      });
    },
    getProjectTimeBounds: function (callback) {
      return a2APIService.get('/recordings/time-bounds').then(function (data) {
        if (callback) {
          callback(data);
        }

        return data;
      });
    },
    getRecordings: function (key, options, callback) {
      if (options instanceof Function) {
        callback = options;
        options = {};
      }

      $http.get('/legacy-api/project/' + url + '/recordings/' + key, {
        params: options
      }).success(function (data) {
        callback(data);
      });
    },
    getRecordingAvailability: function (key, callback) {
      return a2APIService.get('/recordings/available/' + key).then(function (data) {
        if (callback) {
          callback(data);
        }

        return data;
      });
    },
    getOneRecording: function (rec_id, callback) {
      $http.get('/legacy-api/project/' + url + '/recordings/find/' + rec_id).success(function (data) {
        callback(data);
      });
    },
    getRecordingInfo: function (rec_id, callback) {
      $http.get('/legacy-api/project/' + url + '/recordings/info/' + rec_id).success(function (data) {
        callback(data);
      }).error(function (err) {
        callback(err);
      });
    },
    getNextRecording: function (rec_id, callback) {
      $http.get('/legacy-api/project/' + url + '/recordings/next/' + rec_id).success(function (data) {
        callback(data);
      });
    },
    getPreviousRecording: function (rec_id, callback) {
      $http.get('/legacy-api/project/' + url + '/recordings/previous/' + rec_id).success(function (data) {
        callback(data);
      });
    },
    validateRecording: function (rec_id, validation, callback) {
      $http.post('/legacy-api/project/' + url + '/recordings/validate/' + rec_id, validation).success(function (data) {
        callback(data);
      });
    },
    recExists: function (site_id, filename, callback) {
      $http.get('/legacy-api/project/' + url + '/recordings/exists/site/' + site_id + '/file/' + filename).success(function (data) {
        callback(data.exists);
      });
    },
    downloadRecording: function (rec_id, callback) {
      $http.get('/legacy-api/project/' + url + '/recordings/download/' + rec_id).success(function (data) {
        callback(data);
      });
    },
    addClass: function (projectClass, callback) {
      return $http.post('/legacy-api/project/' + url + '/class/add', projectClass);
    },
    removeClasses: function (projectClasses, callback) {
      return $http.post('/legacy-api/project/' + url + '/class/del', projectClasses);
    },
    getUsers: function (callback) {
      $http.get('/legacy-api/project/' + url + '/users').success(function (data) {
        callback(null, data);
      }).error(function (err) {
        callback(err);
      });
    },
    getRoles: function (callback) {
      $http.get('/legacy-api/project/' + url + '/roles').success(function (data) {
        callback(null, data);
      }).error(function (err) {
        callback(err);
      });
    },
    addUser: function (data, callback) {
      $http.post('/legacy-api/project/' + url + '/user/add', data).success(function (response) {
        callback(null, response);
      }).error(function (err) {
        callback(err);
      });
    },
    removeUser: function (data, callback) {
      $http.post('/legacy-api/project/' + url + '/user/del', data).success(function (response) {
        callback(null, response);
      }).error(function (err) {
        callback(err);
      });
    },
    changeUserRole: function (data, callback) {
      $http.post('/legacy-api/project/' + url + '/user/role', data).success(function (response) {
        callback(null, response);
      }).error(function (err) {
        callback(err);
      });
    },
    getModels: function (callback) {
      $http.get('/legacy-api/project/' + url + '/models').success(function (response) {
        callback(null, response);
      }).error(function (err) {
        callback(err);
      });
    },
    getClassi: function (callback) {
      $http.get('/legacy-api/project/' + url + '/classifications').success(function (response) {
        callback(null, response);
      }).error(function (err) {
        callback(err);
      });
    },
    validationsCount: function (callback) {
      $http.get('/legacy-api/project/' + url + '/validations/count').success(function (response) {
        callback(response.count);
      });
    },
    validationBySpeciesSong: function (speciesId, songtypeId, callback) {
      $http.get('/legacy-api/project/' + url + '/validations', {
        params: {
          species_id: speciesId,
          sound_id: songtypeId
        }
      }).success(callback);
    },
    getProjectsList: function (ownershipType, callback) {
      var config = {
        params: {}
      };

      if (ownershipType) {
        config.params.type = ownershipType;
      }

      $http.get('/legacy-api/user/projectlist', config).success(function (response) {
        callback(response);
      });
    },
    removeProject: function (data) {
      return $http.post('/legacy-api/project/' + url + '/remove', data);
    }
  };
}]);
angular.module('a2.srv.resolve', []).factory('$promisedResolve', ["$q", "$injector", function ($q, $injector) {
  return function $resolve(resolveMap, context) {
    context = context || {};
    return $q.all(Object.keys(resolveMap).map(function (key) {
      return $q.resolve().then(function () {
        return $injector.invoke(resolveMap[key]);
      }).then(function (value) {
        context[key] = value;
      });
    })).then(function () {
      return context;
    });
  };
}]);
angular.module('a2.service.serialize-promised-fn', [])
/** serializePromisedFn function decorator.
 * Decorates a promise-returning function so that
 * concurrent calls occur in a serialized manner, 
 * that is, each call takes turn in a queue and gets
 * processed one at a time, in call order.
 */
.service('serializePromisedFn', ["$q", function ($q) {
  return function serializePromisedFn(fn) {
    var series = $q.resolve();
    return function serializedPromisedFn() {
      var context = this;
      var args = Array.prototype.slice.call(arguments);
      series = series.then(function () {
        return fn.apply(context, args);
      });
      return series;
    };
  };
}]);
angular.module('a2.srv.sites', ['a2.srv.project', 'humane']).factory('a2Sites', ["$http", "$q", "Project", "notify", function ($http, $q, Project, notify) {
  return {
    listPublished: function (callback) {
      $http.get('/legacy-api/sites/published').success(function (data) {
        callback(data);
      });
    },
    import: function (site, callback) {
      $http.post('/legacy-api/project/' + Project.getUrl() + '/sites/import', {
        site: site
      }).success(callback);
    },
    update: function (site, callback) {
      $http.post('/legacy-api/project/' + Project.getUrl() + '/sites/update', {
        site: site
      }).success(callback).error(notify.serverError);
    },
    create: function (site, callback) {
      $http.post('/legacy-api/project/' + Project.getUrl() + '/sites/create', {
        site: site
      }).success(callback).error(notify.serverError);
    },
    delete: function (sites, callback) {
      $http.post('/legacy-api/project/' + Project.getUrl() + '/sites/delete', {
        sites: sites
      }).success(callback).error(notify.serverError);
    },
    // Uses Promises :-)
    getLogFiles: function (site, callback) {
      return $http.get('/legacy-api/project/' + Project.getUrl() + '/sites/' + site + '/logs');
    },
    getSiteLogDataDates: function (site, series) {
      var d = $q.defer();
      $http.get('/legacy-api/project/' + Project.getUrl() + '/sites/' + site + '/log/data.txt?get=dates').success(d.resolve.bind(d)).error(d.reject.bind(d));
      return d.promise;
    },
    getSiteLogDataUrl: function (site, series, from, to, period) {
      var args = 'q=' + period + '&from=' + from.getTime() + '&to=' + to.getTime();

      if (/uploads/.test(series)) {
        return $q.resolve('/legacy-api/project/' + Project.getUrl() + '/sites/' + site + '/uploads.txt?' + args);
      } else if (/recordings/.test(series)) {
        return $q.resolve('/legacy-api/project/' + Project.getUrl() + '/sites/' + site + '/data.txt?' + args);
      } else {
        return $q.resolve('/legacy-api/project/' + Project.getUrl() + '/sites/' + site + '/log/data.txt?stat=' + series + '&' + args);
      }
    },
    getSiteLogData: function (site, series, from, to, period) {
      return this.getSiteLogDataUrl(site, series, from, to, period).then(function (url) {
        return $q.when($http.get(url));
      }).then(function (response) {
        var data = {};

        if (response.data) {
          data.rows = response.data.trim().split('\n').map(function (line) {
            return line.split(',');
          });
        }

        return data;
      });
    },
    // Get list of assets to a site
    getListOfAssets: function (site_id) {
      var d = $q.defer();
      $http.get('/legacy-api/project/' + Project.getUrl() + '/streams/' + site_id + '/assets').success(d.resolve.bind(d)).error(d.reject.bind(d));
      return d.promise;
    },
    // Uses Promises
    generateToken: function (site) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/sites/generate-token', {
        site: site.id
      });
    },
    revokeToken: function (site) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/sites/revoke-token', {
        site: site.id
      });
    }
  };
}]);
angular.module('a2.srv.soundscape-composition', ['a2.srv.api']).factory('a2SoundscapeCompositionService', ["$q", "a2APIService", function ($q, a2APIService) {
  return {
    getClassList: function (options) {
      options = options || {};
      var params = {};

      if (options.tally) {
        params.tally = 1;
      }

      if (options.isSystemClass) {
        params.isSystemClass = 1;
      }

      return a2APIService.get('/soundscape-composition/classes', {
        params: params
      }).then(function (classList) {
        if (options.groupByType) {
          return classList.reduce(function (_, item) {
            if (!_.index[item.typeId]) {
              _.list.push(_.index[item.typeId] = {
                type: item.type,
                typeId: item.typeId,
                list: []
              });
            }

            _.index[item.typeId].list.push(item);

            return _;
          }, {
            list: [],
            index: {}
          }).list;
        } else {
          return classList;
        }
      });
    },
    addClass: function (name, typeId) {
      return a2APIService.post('/soundscape-composition/add-class', {
        name: name,
        type: typeId
      });
    },
    removeClass: function (scClassid) {
      return a2APIService.post('/soundscape-composition/remove-class', {
        id: scClassid
      });
    },
    getAnnotationsFor: function (visobject) {
      if (visobject && /^recording$/.test(visobject.type)) {
        return a2APIService.get('/soundscape-composition/annotations/' + (visobject.id | 0));
      } else {
        return $q.resolve([]);
      }
    },
    annotate: function (visobject, annotation) {
      if (visobject && /^recording$/.test(visobject.type)) {
        return a2APIService.post('/soundscape-composition/annotate/' + (visobject.id | 0), annotation);
      } else {
        return $q.reject(new Error("Cannot add soundscape composition annotation" + (visobject ? " to " + visobject.type : "") + "."));
      }
    }
  };
}]);
angular.module('a2.srv.soundscapes', ['a2.srv.project', 'humane']).factory('a2Soundscapes', ["Project", "$http", "$q", "notify", function (Project, $http, $q, notify) {
  var saveData = null;
  return {
    saveState: function (data) {
      saveData = data;
    },
    getState: function () {
      return saveData;
    },
    getAmplitudeReferences: function () {
      return $q.resolve([{
        value: 'absolute',
        caption: "Absolute",
        description: "The threshold is taken as an absolute value of the amplitude of each peak."
      }, {
        value: 'relative-to-peak-maximum',
        caption: "Relative to maximum",
        description: "The threshold is taken as a relative proportion of the maximum amplitude of the peaks in the soundscape."
      }]);
    },
    get: function (soundscapeId, callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId).success(function (data) {
        callback(data);
      });
    },
    getSCIdx: function (soundscapeId, params, callback) {
      if (params instanceof Function) {
        callback = params;
        params = undefined;
      }

      if (!params) {
        params = {};
      }

      var d = $q.defer();
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/scidx', {
        params: params
      }).success(function (data) {
        if (callback) callback(data);
        d.resolve(data);
      });
      return d.promise;
    },
    getNormVector: function (soundscapeId, callback) {
      var d = $q.defer();
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/norm-vector').success(function (data) {
        if (callback) callback(data);
        d.resolve(data);
      });
      return d.promise;
    },
    // TODO fusion getList and getList2 routes to return needed data
    getList: function (query, callback) {
      if (query instanceof Function) {
        callback = query;
        query = {};
      }

      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/', {
        params: query
      }).success(function (data) {
        callback(data);
      });
    },
    getList2: function (callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/soundscapes/details').success(callback).error(notify.serverError);
    },
    setVisualizationOptions: function (soundscapeId, params, callback) {
      var projectName = Project.getUrl();
      $http.post('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/scale', params).success(function (data) {
        callback(data);
      });
    },
    addRegion: function (soundscapeId, bbox, params, callback) {
      var projectName = Project.getUrl();
      params.bbox = bbox;
      $http.post('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/regions/add', params).success(function (data) {
        callback(data);
      });
    },
    sampleRegion: function (soundscapeId, region, params, callback) {
      var projectName = Project.getUrl();
      $http.post('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/regions/' + region + '/sample', params).success(function (data) {
        callback(data);
      });
    },
    getExportUrl: function (options) {
      var soundscapeId = options.soundscape.soundscape_id;
      var d = $q.defer();
      var projectName = Project.getUrl();
      var args = [];

      if (options.raw) {
        args.push('raw=1');
      }

      d.resolve('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/export-list' + (args.length ? '?' + args.join('&') : ''));
      return d.promise;
    },
    getRegion: function (soundscapeId, region, callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/regions/' + region).success(function (data) {
        callback(data);
      });
    },
    getRecordingTags: function (soundscapeId, region, recording, callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/regions/' + region + '/tags/' + recording).success(function (data) {
        callback(data);
      });
    },
    addRecordingTag: function (soundscapeId, region, recording, tag, callback) {
      var projectName = Project.getUrl();
      $http.post('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/regions/' + region + '/tags/' + recording + '/add', {
        tag: tag
      }).success(callback);
    },
    removeRecordingTag: function (soundscapeId, region, recording, tag, callback) {
      var projectName = Project.getUrl();
      $http.post('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/regions/' + region + '/tags/' + recording + '/remove', {
        tag: tag
      }).success(callback);
    },
    getRegions: function (soundscapeId, query, callback) {
      if (query instanceof Function) {
        callback = query;
        query = undefined;
      }

      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/regions', {
        params: query
      }).success(function (data) {
        callback(data);
      });
    },
    getRecordings: function (soundscapeId, bbox, query, callback) {
      if (query instanceof Function) {
        callback = query;
        query = {};
      }

      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/soundscapes/' + soundscapeId + '/recordings/' + bbox, {
        params: query
      }).success(function (data) {
        callback(data);
      });
    },
    // TODO change method to receive id
    findIndices: function (soundscapeId, callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/soundscapes/' + soundscapeId + '/indices').success(callback);
    },
    delete: function (soundscapeId, callback) {
      $http.get('/legacy-api/project/' + Project.getUrl() + '/soundscapes/' + soundscapeId + "/delete").success(callback).error(notify.serverError);
    },
    create: function (soundscapeData) {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/soundscape/new', soundscapeData);
    }
  };
}]);
angular.module('a2.srv.species', []).factory('Species', ["$http", function ($http) {
  var species;
  return {
    get: function (callback) {
      if (species) return callback(species);
      $http.get('/legacy-api/species/list/100').success(function (data) {
        species = data;
        callback(species);
      });
    },
    search: function (query, callback) {
      $http.get('/legacy-api/species/search', {
        params: {
          q: query
        }
      }).success(function (data) {
        callback(data);
      });
    },
    findById: function (species_id, callback) {
      return $http.get('/legacy-api/species/' + species_id).then(function (response) {
        if (callback) {
          callback(response.data);
        }

        return response.data;
      });
    }
  };
}]).factory('Songtypes', ["$http", function ($http) {
  var songs;

  var searchId = function (id, callback) {
    var s = songs.filter(function (song) {
      return song.id === id;
    });
    if (s !== null) callback(s[0]);
  };

  return {
    get: function (callback) {
      if (songs) return callback(songs);
      $http.get('/legacy-api/songtypes/all').success(function (data) {
        songs = data;
        callback(songs);
      });
    },
    findById: function (songtype_id, callback) {
      if (songs) {
        searchId(songtype_id, callback);
        return;
      }

      $http.get('/legacy-api/songtypes/all').success(function (data) {
        songs = data;
        searchId(songtype_id, callback);
      });
    }
  };
}]).factory('SpeciesTaxons', ["$http", function ($http) {
  var speciesTaxons;
  return {
    getList: function (callback) {
      if (speciesTaxons) return callback(speciesTaxons);
      $http.get('/legacy-api/species_taxons/all').success(function (data) {
        speciesTaxons = data;
        callback(speciesTaxons);
      });
    }
  };
}]);
angular.module('a2.srv.tags', ['a2.srv.api']).factory('a2Tags', ["$q", "a2APIService", "notify", function ($q, a2APIService, notify) {
  function isTaggableType(type) {
    return /^recording$/.test('' + type);
  }

  function isTaggableResource(obj) {
    return obj && isTaggableType(obj.type) && obj.id;
  }

  return {
    getFor: function (visobject) {
      if (isTaggableResource(visobject)) {
        return a2APIService.get('/tags/' + visobject.type + '/' + (visobject.id | 0));
      } else {
        return $q.resolve([]);
      }
    },
    getForType: function (resourceType) {
      if (isTaggableType(resourceType)) {
        return a2APIService.get('/tags/' + resourceType);
      } else {
        return $q.resolve([]);
      }
    },
    deleteFor: function (visobject, tagId) {
      if (isTaggableResource(visobject)) {
        return a2APIService.delete('/tags/' + visobject.type + '/' + (visobject.id | 0) + '/' + tagId);
      } else {
        return $q.resolve([]);
      }
    },
    addFor: function (visobject, tag) {
      if (isTaggableResource(visobject)) {
        var data = {};

        if (tag.tag_id) {
          data.id = tag.tag_id;
        } else {
          data.text = tag.tag;
        }

        if (tag.t0 !== undefined) {
          data.t0 = tag.t0;
          data.f0 = tag.f0;
          data.t1 = tag.t1;
          data.f1 = tag.f1;
        }

        return a2APIService.put('/tags/' + visobject.type + '/' + (visobject.id | 0), data).catch(notify.serverError);
      } else {
        return $q.resolve([]);
      }
    },
    search: function (text) {
      return a2APIService.get('/tags/?q=' + text);
    }
  };
}]);
angular.module('a2.srv.templates', ['a2.srv.project']).factory('a2Templates', ["Project", "$http", "notify", function (Project, $http, notify) {
  return {
    getList: function (opts) {
      var projectName = Project.getUrl();
      var config = {
        params: {}
      };

      if (opts && opts.showRecordingUri) {
        config.params.showRecordingUri = opts.showRecordingUri;
      }

      if (opts && opts.projectTemplates) {
        config.params.projectTemplates = opts.projectTemplates;
      }

      if (opts && opts.publicTemplates) {
        config.params.publicTemplates = opts.publicTemplates;
      }

      if (opts && opts.q) {
        config.params.q = opts.q;
      }

      if (opts && opts.taxon) {
        config.params.taxon = opts.taxon;
      }

      if (opts && opts.limit) {
        config.params.limit = opts.limit;
      }

      if (opts && opts.offset !== undefined) {
        config.params.offset = opts.offset;
      }

      return $http.get('/legacy-api/project/' + projectName + '/templates', config).then(function (response) {
        return response.data;
      });
    },
    count: function (opts) {
      var config = {
        params: {}
      };

      if (opts && opts.publicTemplates) {
        config.params.publicTemplates = opts.publicTemplates;
      }

      return $http.get('/legacy-api/project/' + Project.getUrl() + '/templates/count', config).then(function (response) {
        return response.data;
      });
    },
    add: function (template_data) {
      var projectName = Project.getUrl();
      return $http.post('/legacy-api/project/' + projectName + '/templates/add', template_data).then(function (response) {
        return response.data;
      }).catch(notify.serverError);
    },
    getAudioUrlFor: function (template) {
      const ext = '.mp3';
      return '/legacy-api/project/' + Project.getUrl() + '/templates/audio/' + template.id + ext;
    },
    delete: function (templateId) {
      var projectName = Project.getUrl();
      return $http.post('/legacy-api/project/' + projectName + '/templates/' + templateId + '/remove');
    },
    getImage: function (templateId) {
      var projectName = Project.getUrl();
      return $http.get('/legacy-api/project/' + projectName + '/templates/data/' + templateId + '/image').then(function (response) {
        return response.data;
      });
    }
  };
}]);
angular.module('a2.srv.training-sets', ['a2.srv.project']).factory('a2TrainingSets', ["Project", "$http", function (Project, $http) {
  return {
    getList: function (callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/training-sets').success(function (data) {
        callback(data);
      });
    },
    add: function (tset_data, callback) {
      var projectName = Project.getUrl();
      $http.post('/legacy-api/project/' + projectName + '/training-sets/add', tset_data).success(function (data) {
        callback(data);
      });
    },
    edit: function (trainingSetId, tset_data) {
      var projectName = Project.getUrl();
      return $http.post('/legacy-api/project/' + projectName + '/training-sets/edit/' + trainingSetId, tset_data);
    },
    delete: function (trainingSetId) {
      var projectName = Project.getUrl();
      return $http.post('/legacy-api/project/' + projectName + '/training-sets/remove/' + trainingSetId);
    },
    addData: function (trainingSetId, tset_data, callback) {
      var projectName = Project.getUrl();
      $http.post('/legacy-api/project/' + projectName + '/training-sets/add-data/' + trainingSetId, tset_data).success(function (data) {
        callback(data);
      });
    },
    getData: function (trainingSetId, recording_uri, callback) {
      if (recording_uri instanceof Function) {
        callback = recording_uri;
        recording_uri = "";
      }

      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/training-sets/list/' + trainingSetId + '/' + recording_uri).success(function (data) {
        callback(data);
      });
    },
    getDataImage: function (trainingSetId, dataId, callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/training-sets/data/' + trainingSetId + '/get-image/' + dataId).success(function (data) {
        callback(data);
      });
    },
    getTypes: function (callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/training-sets/types').success(function (data) {
        callback(data);
      });
    },
    getRois: function (trainingSetId, callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/training-sets/rois/' + trainingSetId).success(function (data) {
        callback(data);
      });
    },
    getExportUrl: function (trainingSetId) {
      var projectName = Project.getUrl();
      return '/legacy-api/project/' + projectName + '/training-sets/rois/' + trainingSetId + '?export=1';
    },
    getSpecies: function (trainingSetId, callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/training-sets/species/' + trainingSetId).success(function (data) {
        callback(data);
      });
    },
    removeRoi: function (trainingSetId, roiId, callback) {
      var projectName = Project.getUrl();
      $http.get('/legacy-api/project/' + projectName + '/training-sets/' + trainingSetId + '/remove-roi/' + roiId).success(function (data) {
        callback(data);
      });
    }
  };
}]);
angular.module('a2.srv.uploads', ['a2.srv.api']).factory('a2UploadsService', ["a2APIService", function (a2APIService) {
  return {
    getProcessingList: function (opts) {
      const config = {
        params: opts
      };
      return a2APIService.get('/uploads/processing', config).then(function (data) {
        return data;
      });
    },
    checkStatus: function (opts) {
      const config = {
        params: opts
      };
      return a2APIService.get('/uploads/check', config).then(function (data) {
        return data.items;
      });
    }
  };
}]);
angular.module('a2.srv.users', []).factory('Users', ["$http", function ($http) {
  var users;
  return {
    getInfoForId: function (user_id) {
      return $http.get('/legacy-api/user/info/' + user_id).then(function (response) {
        return response.data.user;
      });
    }
  };
}]);
angular.module('a2.filters', ['a2.filter.as-csv', 'a2.filter.caps', 'a2.filter.a2-page-number-to-title', 'a2.filter.a2-page-title-to-number', 'a2.filter.project-url', 'a2.filter.range', 'a2.filter.round', 'a2.filter.time-from-now']);
angular.module('a2.filter.as-csv', []).filter('asCSV', function () {
  return function (value, delimiter, filter) {
    if (!(value instanceof Array)) {
      if (typeof value == 'object') {
        value = Object.keys(value).map(function (key) {
          return key + "=" + (value[key] === undefined ? '' : value[key]);
        });
      } else {
        value = [value];
      }
    }

    if (filter) {
      value = value.filter(function (v) {
        return !!v;
      });
    }

    return value.join(delimiter || ', ');
  };
});
angular.module('a2.filter.caps', []).filter('caps', function () {
  return function (input, type) {
    if (!input) {
      return undefined;
    }

    switch (type || 'title') {
      case 'title-case':
        return input.replace(/\b\w/g, function (_) {
          return _.toUpperCase();
        });

      default:
        return input;
    }
  };
});
angular.module('a2.filter.a2-page-number-to-title', []).filter('a2PageNumberToTitle', function () {
  return function a2PageNumberToTitle(page_number) {
    return page_number + 1;
  };
});
angular.module('a2.filter.a2-page-title-to-number', []).filter('a2PageTitleToNumber', function () {
  return function a2PageTitleToNumber(page_title) {
    var page_number;

    if (!isFinite(page_title) || page_title === '') {
      page_number = '';
    } else if (page_title == '0') {
      page_number = 9;
    } else {
      page_number = page_title - 1;
    }

    return page_number;
  };
});
angular.module('a2.filter.project-url', []).filter('projectUrl', ["a2APIService", function (a2APIService) {
  return function (url) {
    return a2APIService.project.getUrl(url);
  };
}]);
angular.module('a2.filter.range', []).filter('a2Range', function () {
  return function (from, to, step) {
    if (!to) {
      to = from;
      from = 0;
    }

    if (!step) {
      step = Math.sign(to - from);
    }

    var stepSign = Math.sign(step);
    var list = [];

    if (step != 0) {
      for (var i = from; (i - to) * stepSign < 0; i += step) {
        list.push(i);
      }
    }

    return list;
  };
});
angular.module('a2.filter.round', []).filter('round', function () {
  return function (val, precision) {
    precision = precision || 1;
    return (val / precision | 0) * precision || 0;
  };
});
angular.module('a2.filter.time-from-now', []).filter('timeFromNow', function () {
  return function (input, fmt) {
    if (!input) return undefined;
    return moment(input).fromNow();
  };
});
angular.module('a2.orders.change-project-plan', ['a2.orders.order-utils', 'a2.orders.orders', 'ui.bootstrap', 'humane', 'a2.directives', 'a2.services']).controller('ChangeProjectPlanCtrl', ["$scope", "orderData", "Project", "$window", "a2order", "$modalInstance", "notify", "a2orderUtils", function ($scope, orderData, Project, $window, a2order, $modalInstance, notify, a2orderUtils) {
  $scope.today = new Date();
  console.log(orderData);
  $scope.recorderQty = orderData.recorderQty;
  a2orderUtils.getOrdersContact().then(function (response) {
    $scope.ordersContact = response.data;
  });
  a2orderUtils.paymentsStatus().then(function (response) {
    $scope.autoPaymentsEnabled = response.data.payments_enable;
  });
  Project.getInfo(function (info) {
    $scope.project = info;
    $scope.currentPlan = {
      storage: info.storage_limit,
      processing: info.processing_limit,
      duration: info.plan_period,
      tier: info.tier,
      activation: info.plan_activated,
      creation: info.plan_created
    };

    if ($scope.currentPlan.activation && $scope.currentPlan.duration) {
      var due = new Date($scope.currentPlan.activation);
      due.setFullYear(due.getFullYear() + $scope.currentPlan.duration);
      $scope.currentPlan.due = due;
    }

    if ($scope.currentPlan.due && $scope.currentPlan.due < $scope.today) {
      $scope.mode = 'renew';
    } else if ($scope.currentPlan.duration) {
      $scope.mode = 'upgrade';
    } else {
      $scope.mode = 'new';
    }

    $scope.project.plan = orderData.project && orderData.project.plan || {};
    Project.getUsage().success(function (usage) {
      $scope.minUsage = usage.min_usage;
    });
  });

  $scope.upgrade = function () {
    if (!$scope.autoPaymentsEnabled) {
      return notify.log('Payments are unavailable');
    }

    if ($scope.mode == 'renew') {
      if ($scope.project.plan.storage < $scope.minUsage) {
        notify.error('Please select a plan with more capacity or delete recordings from the project');
        return;
      }
    } else {
      if ($scope.currentPlan.storage && $scope.project.plan.storage - $scope.currentPlan.storage <= 0) {
        notify.error('To upgrade select a plan with more capacity than the current');
        return;
      }
    }

    orderData = {
      action: 'update-project',
      project: $scope.project,
      recorderQty: $scope.recorderQty,
      mode: $scope.mode
    };

    if ($scope.recorderQty > 0 && $scope.project.plan.tier == 'paid') {
      a2order.enterShippingAddress(orderData);
    } else {
      a2order.reviewOrder(orderData);
    }

    $modalInstance.dismiss();
  };
}]);
angular.module('a2.orders.create-project', ['a2.orders.orders', 'a2.orders.order-utils', 'a2.orders.plan-selection', 'a2.orders.project-order-service', 'ui.bootstrap', 'humane']).controller('CreateProjectCtrl', ["$scope", "$http", "$modalInstance", "$modal", "notify", "a2order", "orderData", "a2orderUtils", "ProjectOrderService", function ($scope, $http, $modalInstance, $modal, notify, a2order, orderData, a2orderUtils, ProjectOrderService) {
  $scope.project = orderData.project;
  $scope.recorderQty = orderData.recorderQty;
  a2orderUtils.getOrdersContact().then(function (response) {
    $scope.ordersContact = response.data;
  });
  a2orderUtils.paymentsStatus().then(function (response) {
    $scope.autoPaymentsEnabled = response.data.payments_enable;
  });

  $scope.create = function () {
    console.log($scope.isValid);

    if (!$scope.isValid) {
      return;
    }

    return ProjectOrderService.makeOrder('create-project', $scope.project, $scope.recorderQty, {
      autoPaymentsEnabled: $scope.autoPaymentsEnabled
    }).then(function (order) {
      console.log(order); // if user added recorders to paid order show shipping address form

      if (order.hasCoupon || !order.isPaidProject) {
        return ProjectOrderService.placeOrder(order.data).then(function () {
          return $modalInstance.close();
        });
      } else if (order.isPaidProject && order.data.recorderQty > 0) {
        a2order.enterShippingAddress(order.data);
        $modalInstance.dismiss();
      } else {
        a2order.reviewOrder(order.data);
        $modalInstance.dismiss();
      }
    });
  };
}]);
angular.module('a2.orders.order-summary', ['a2.orders.orders', 'a2.orders.order-utils', 'a2.orders.project-order-service', 'ui.bootstrap', 'humane']).controller('OrderSummaryCtrl', ["$scope", "$http", "$modalInstance", "orderData", "notify", "$window", "a2order", "a2orderUtils", "ProjectOrderService", function ($scope, $http, $modalInstance, orderData, notify, $window, a2order, a2orderUtils, ProjectOrderService) {
  if (orderData.address) {
    $scope.address = orderData.address;
  }

  $scope.type = orderData.mode == 'upgrade' ? 'upgrade' : 'new';
  $scope.info = a2orderUtils.info;
  $scope.shipping = orderData.shipping || 0;
  $scope.project = orderData.project;
  $scope.plan = orderData.project.plan;
  $scope.recorderQty = orderData.recorderQty || 0;

  $scope.changeItems = function () {
    if (orderData.action == 'create-project') {
      a2order.createProject(orderData);
    } else {
      a2order.changePlan(orderData);
    }

    $modalInstance.dismiss();
  };

  $scope.editAddress = function () {
    a2order.enterShippingAddress(orderData);
    $modalInstance.dismiss();
  };

  $scope.submit = function () {
    $scope.waiting = true;
    console.log(orderData);
    return ProjectOrderService.placeOrder(orderData).then(function (data) {
      console.log(data);

      if (data.message) {
        // if free project notify project was created
        $modalInstance.close();
      } else if (data.approvalUrl) {
        // else redirect to paypal
        $window.location.assign(data.approvalUrl);
      }

      $scope.waiting = false;
    }).catch(function (err) {
      $scope.waiting = false;
    });
  };
}]);
angular.module('a2.orders.order-utils', []).service('a2orderUtils', ["$http", function ($http) {
  return {
    /**
        receives a plan activation date and duration period, and calculates 
        how many month are left until the plan is due
        @param [Date] acticationDate
        @param [Number] period
    */
    monthsUntilDue: function (acticationDate, period) {
      var d = new Date(acticationDate);
      var totalMonths = period * 12;
      var today = new Date();
      var currentMonth;

      for (var i = 0; i <= totalMonths; i++) {
        var month = new Date(d.getFullYear(), d.getMonth() + i, d.getDate());

        if (today <= month) {
          currentMonth = i - 1;
          break;
        }
      }

      return totalMonths - currentMonth;
    },
    paymentsStatus: function () {
      return $http.get('/legacy-api/orders/payments-status', {
        cache: true
      });
    },
    checkCouponCode: function (code, project) {
      return $http.post('/legacy-api/orders/check-coupon', {
        hash: code,
        project: project
      }).then(function (response) {
        return response.data;
      });
    },
    getOrdersContact: function () {
      return $http.get('/legacy-api/orders/contact', {
        cache: true
      });
    },
    info: {
      recorder: {
        name: 'Arbimon Recorder',
        description: "includes an Android device preset for acoustic monitoring, " + "waterproof case(IP67), microphone, 6500mAh lithium-ion battery " + "and USB charger",
        priceWithPlan: 125,
        priceNoPlan: 300
      },
      plan: {
        new: {
          name: "Project data plan",
          description: function (plan) {
            return "includes storage for " + plan.storage + " minutes of audio " + "and capacity to process " + plan.processing + " minutes of audio " + "per year, for a term of " + plan.duration + " year(s)";
          }
        },
        upgrade: {
          name: "Project data plan upgrade",
          description: function (plan) {
            return "upgrade your plan storage to " + plan.storage + " minutes of audio " + "and capacity to process " + plan.processing + " minutes of audio " + "per year, until this plan due";
          }
        }
      }
    }
  };
}]);
angular.module('a2.orders.orders', ['a2.orders.create-project', 'a2.orders.change-project-plan', 'a2.orders.shipping-form', 'a2.orders.order-summary', 'ui.bootstrap']).service('a2order', ["$modal", function ($modal) {
  var formOpener = function (orderData, view) {
    var modalOptions = {
      resolve: {
        orderData: function () {
          return orderData;
        }
      },
      backdrop: 'static',
      templateUrl: view.templateUrl,
      controller: view.controller
    };
    return $modal.open(modalOptions);
  };

  return {
    createProject: function (orderData) {
      var modalInstance = formOpener(orderData, {
        templateUrl: '/orders/create-project.html',
        controller: 'CreateProjectCtrl'
      });
      return modalInstance;
    },
    changePlan: function (orderData) {
      var modalInstance = formOpener(orderData, {
        templateUrl: '/orders/change-plan.html',
        controller: 'ChangeProjectPlanCtrl'
      });
      return modalInstance;
    },
    enterShippingAddress: function (orderData) {
      var modalInstance = formOpener(orderData, {
        templateUrl: '/orders/shipping-address.html',
        controller: 'ShippingFormCtrl'
      });
      return modalInstance;
    },
    reviewOrder: function (orderData) {
      var modalInstance = formOpener(orderData, {
        templateUrl: '/orders/order-summary.html',
        controller: 'OrderSummaryCtrl'
      });
      return modalInstance;
    }
  };
}]);
angular.module('a2.orders.directives.plan-capacity', ['a2.orders.plan-selection', 'countries-list', 'ui.bootstrap', 'humane', 'a2.directives', 'a2.services']).directive('planCapacity', function () {
  return {
    restrict: 'E',
    scope: {
      'disabled': '=',
      'minutes': '='
    },
    templateUrl: '/orders/plan-capacity.html',
    link: function (scope, element, attrs) {
      if (!attrs.enabled) {
        scope.enabled = true;
      }
    }
  };
});
angular.module('a2.orders.plan-selection', ['countries-list', 'ui.bootstrap', 'humane', 'a2.orders.directives.plan-capacity', 'a2.orders.directives.tier-select', 'a2.directives', 'a2.services']).controller('PlanSelectionCtrl', ["$scope", "a2orderUtils", function ($scope, a2orderUtils) {
  const freePlan = {
    // Changes must be matched in app/model/projects.js
    tier: 'free',
    cost: 0,
    storage: 100000,
    processing: 10000000
  };
  this.coupon = {
    code: '',
    validation: null
  };

  this.checkCouponCode = function () {
    if (this.coupon.code) {
      this.coupon.validation = {
        class: 'fa fa-spinner fa-spin'
      };
      delete this.coupon.payload;
      delete $scope.plan.coupon;
      return a2orderUtils.checkCouponCode(this.coupon.code, this.project).then(function (code) {
        if (code.valid) {
          $scope.plan.coupon = code;
          this.coupon.payload = code.payload;
          this.coupon.validation = {
            valid: true,
            class: 'fa fa-check text-success'
          };
        } else {
          this.coupon.validation = {
            valid: false,
            class: 'fa fa-times text-danger'
          };
        }
      }.bind(this), function () {
        this.coupon.validation = {
          valid: false,
          class: 'fa fa-times text-danger'
        };
      }.bind(this));
    } else {
      delete this.coupon.validation;
    }
  };

  $scope.plan = freePlan;
  $scope.recorderOptions = 0;
  $scope.planMinutes = $scope.planMinutes || freePlan.storage;
  $scope.planYears = $scope.planYears || 1;
  $scope.upgradeOnly = false;
  $scope.recorderQty = $scope.recorderQty || 0;
  console.log($scope.plan);
  this.hasCouponCode = false;
  this.planData = {
    yearOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  };
  $scope.$watch('currentPlan', function () {
    if (!$scope.currentPlan) return;
    var due = new Date($scope.currentPlan.activation);
    due.setFullYear(due.getFullYear() + $scope.currentPlan.duration);
    $scope.planYears = $scope.currentPlan.duration || 1;
    $scope.planMinutes = $scope.currentPlan.storage >= freePlan.storage ? $scope.currentPlan.storage : freePlan.storage;

    if ($scope.currentPlan.tier == 'paid' && (!$scope.currentPlan.activation || new Date() < due)) {
      $scope.upgradeOnly = true;
      $scope.plan.tier = 'paid';
    }
  });
  $scope.$watch('plan', function (value) {
    if ($scope.plan) {
      if ($scope.plan.storage) $scope.planMinutes = $scope.plan.storage;
      if ($scope.plan.duration) $scope.planYears = $scope.plan.duration;
    }
  });
  $scope.$watch('plan.tier', function (value) {
    if (!$scope.plan) return;

    if ($scope.plan.tier == 'paid') {
      $scope.plan.cost = $scope.planMinutes * 0.03 * $scope.planYears;
      $scope.plan.storage = +$scope.planMinutes;
      $scope.plan.processing = $scope.planMinutes * 100;
      $scope.plan.duration = $scope.planYears;
      console.log($scope.plan);
    } else if ($scope.plan.tier == 'free') {
      $scope.plan.cost = freePlan.cost;
      $scope.plan.storage = freePlan.storage;
      $scope.plan.processing = freePlan.processing;
      $scope.plan.duration = undefined;
    }
  });

  var updatePlan = function () {
    $scope.plan = $scope.plan || {};

    if ($scope.upgradeOnly) {
      if ($scope.currentPlan.storage > $scope.planMinutes) {
        $scope.planMinutes = $scope.currentPlan.storage;
      }

      var planStarts = $scope.currentPlan.activation || $scope.currentPlan.creation;
      var monthsLeft = a2orderUtils.monthsUntilDue(planStarts, $scope.currentPlan.duration);
      console.log('planStarts', planStarts);
      console.log('monthsLeft', monthsLeft);
      $scope.plan.cost = ($scope.planMinutes - $scope.currentPlan.storage) * monthsLeft * (0.03 / 12);
      $scope.plan.storage = +$scope.planMinutes;
      $scope.plan.processing = $scope.planMinutes * 100;
      $scope.plan.duration = $scope.planYears;
    } else {
      if ($scope.usage && $scope.usage > $scope.planMinutes) {
        $scope.planMinutes = Math.ceil($scope.usage / 5000) * 5000;
      }

      $scope.plan.cost = $scope.planMinutes * $scope.planYears * 0.03;
      $scope.plan.storage = +$scope.planMinutes;
      $scope.plan.processing = $scope.planMinutes * 100;
      $scope.plan.duration = $scope.planYears;
      var recorderCap = Math.floor($scope.planMinutes / 10000) * $scope.planYears;
      $scope.recorderQty = $scope.recorderQty || 0;

      if ($scope.recorderQty > recorderCap) {
        $scope.recorderQty = recorderCap;
      }

      $scope.recorderOptions = new Array(recorderCap + 1);
    }
  };

  this.updatePlan = updatePlan;
  $scope.$watch('planMinutes', updatePlan);
  $scope.$watch('planYears', updatePlan);
}]).directive('planSelect', function () {
  return {
    restrict: 'E',
    scope: {
      'project': '=',
      'plan': '=',
      'recorderQty': '=',
      'availablePlans': '=',
      'ordersContact': '=',
      'autoPaymentsEnabled': '=',
      'currentPlan': '=?',
      'usage': '=?'
    },
    templateUrl: '/orders/select-plan.html',
    controller: 'PlanSelectionCtrl as controller',
    link: function (scope, element, attrs, controller) {
      scope.$watch('project', function (project) {
        controller.project = project;
      });
    }
  };
});
angular.module('a2.orders.process-order', []).controller('ProcessOrderCtrl', ["$scope", "$http", "$window", "$location", function ($scope, $http, $window, $location) {
  var reOrderId = /\/process-order\/([\w\-\d]+)/;
  var result = reOrderId.exec($window.location.pathname);
  var orderId = result !== null ? result[1] : '';
  console.log('orderId:', orderId);
  $scope.processing = true;
  $http.post('/legacy-api/orders/process/' + orderId + $window.location.search).success(function (data) {
    console.log('data', data);
    $scope.invoice = {
      items: data.invoice.item_list.items,
      amount: data.invoice.amount,
      number: data.orderNumber,
      user: data.user
    };

    if (data.invoice.item_list.shipping_address) {
      $scope.invoice.address = data.invoice.item_list.shipping_address;
    }

    $scope.action = data.action;
    $scope.processing = false;
    $scope.success = true;
  }).error(function (data, status) {
    if (status == 404) {
      $scope.notFound = true;
    } else if (status == 400 && data.error == 'APPROVAL_NEEDED') {
      $scope.needApproval = true;
      $scope.approvalLink = data.approvalLink;
    } else if (status == 400 && data.error == 'ALREADY_PROCESSED') {
      $scope.alreadyProcessed = true;
    } else {
      $scope.errorOcurred = true;
    }

    $scope.processing = false;
  });
}]);
angular.module('a2.orders.project-order-service', ['humane']).factory("ProjectOrderService", ["$q", "$filter", "$http", "notify", function ($q, $filter, $http, notify) {
  var currencyFilter = $filter('currency');
  var ProjectOrderService = {
    placeOrder: function (orderData) {
      if (!/(create|update)-project/.test(orderData.action)) {
        return $q.reject("Invalid action " + orderData.action);
      }

      var data = angular.merge({}, orderData);
      delete data.action;
      return $http.post('/legacy-api/orders/' + orderData.action, orderData).then(function (response) {
        var data = response.data; // notify any succesfull messages

        if (data.message) {
          notify.log(data.message);
        }

        return data;
      }).catch(function (response) {
        var err = response.data;
        console.log("err", err);
        console.log("err resp", response);

        if (err) {
          if (err.freeProjectLimit) {
            notify.error('You already have own a free project, ' + 'the limit is one per user.');
          } else if (err.nameExists) {
            notify.error('Name <b>' + orderData.project.name + '</b> not available.');
          } else if (err.urlExists) {
            notify.error('URL <b>' + orderData.project.url + '</b> is taken, choose another one.');
          } else {
            notify.serverError();
          }
        }

        throw err;
      });
    },
    makeOrder: function (action, project, recorderQty, settings) {
      console.log("makeOrder", action, project, recorderQty, settings);

      if (!project || !project.plan) {
        return $q.reject(new Error('You need to select a plan'));
      }

      var isPaidProject = project.plan.tier == 'paid';
      var coupon = project.plan.coupon && project.plan.coupon.valid ? project.plan.coupon : undefined;
      settings.recorderCost = settings.recorderCost || 125;
      settings.projectCostLimit = settings.projectCostLimit || 10000;

      if (coupon) {
        project = angular.merge({}, project);
        delete project.plan;
      } else if (isPaidProject) {
        if (!settings.autoPaymentsEnabled) {
          return $q.reject(new Error('Payments are unavailable'));
        } // don't process orders over $10,000


        if (project.plan.cost + recorderQty * settings.recorderCost > settings.projectCostLimit) {
          return $q.reject(new Error('Cannot process order greater than ' + currencyFilter(settings.projectCostLimit)));
        }
      }

      return $q.resolve({
        hasCoupon: !!coupon,
        isPaidProject: isPaidProject,
        data: {
          action: action,
          coupon: coupon ? coupon.hash : undefined,
          project: project,
          recorderQty: recorderQty
        }
      });
    }
  };
  return ProjectOrderService;
}]);
angular.module('a2.orders.shipping-form', ['a2.orders.orders', 'countries-list', 'ui.bootstrap']).controller('ShippingFormCtrl', ["$scope", "$http", "$modalInstance", "$modal", "orderData", "countries", "a2order", function ($scope, $http, $modalInstance, $modal, orderData, countries, a2order) {
  if (!orderData.address) {
    $http.get('/legacy-api/user/address').success(function (data) {
      $scope.address = data.address || {};
    });
  } else {
    $scope.address = orderData.address;
  }

  countries.get(function (data) {
    $scope.countries = data;
  });

  $scope.verify = function () {
    // TODO this method should validate form and call server to get shipping cost
    $http.post('/legacy-api/orders/calculate-shipping', {
      address: $scope.address,
      recorderQty: orderData.recorderQty
    }).success(function (data) {
      orderData.shipping = data.shipping_cost;
      orderData.address = data.address;
      a2order.reviewOrder(orderData);
      $modalInstance.dismiss();
    });
  };
}]);
angular.module('a2.orders.directives.tier-select', []).directive('tierSelect', function () {
  return {
    restrict: 'E',
    scope: {
      'tier': '=',
      'disableFree': '='
    },
    templateUrl: '/orders/tier-select.html'
  };
});
angular.module('a2.directive.a2-auto-close-on-outside-click', []).directive('a2AutoCloseOnOutsideClick', ["$document", "$rootScope", function ($document, $rootScope) {
  function getElementPath(element) {
    var ancestors = [];
    element = element;

    while (element) {
      ancestors.push(element);
      element = element.parentElement;
    }

    return ancestors;
  }

  return {
    restrict: 'A',
    require: '?dropdown',
    link: function (scope, element, $attrs, dropdownController) {
      $attrs.$set('autoClose', "disabled");

      function closeDropdown(evt) {
        if (!evt || !dropdownController.isOpen()) {
          return;
        }

        var ancestors = getElementPath(evt.target);
        var htmlIdx = ancestors.indexOf($document[0].documentElement);
        var toggleElementIdx = ancestors.indexOf(dropdownController.toggleElement[0]);
        var elementIdx = ancestors.indexOf(dropdownController.dropdownMenu[0]); // console.log(htmlIdx, toggleElementIdx, elementIdx);

        if (toggleElementIdx != -1 || elementIdx != -1 || htmlIdx == -1) {
          return;
        }

        dropdownController.toggle(false);

        if (!$rootScope.$$phase) {
          scope.$apply();
        }
      }

      $document.bind('click', closeDropdown);
      scope.$on('$destroy', function () {
        $document.unbind('click', closeDropdown);
      });
    }
  };
}]);
angular.module('arbimon2.directive.a2-dropdown', []).directive('a2Dropdown', ["$compile", function ($compile) {
  var masterTemplate = angular.element('<div dropdown dropdown-append-to-body>' + '<button class="btn btn-sm btn-default dropdown-toggle" dropdown-toggle>' + '<span></span> <i class="fa fa-caret-down"></i>' + '</button>' + '<ul class="dropdown-menu dropup" role="menu">' + '<li ng-repeat="$item in list" ng-class="{active: $item == $selectedItem}">' + '<a ng-click="select($item)"><span></span></a>' + '</li>' + '</ul>' + '</div>');
  return {
    restrict: 'E',
    require: 'ngModel',
    scope: true,
    compile: function (element, attrs) {
      var tpl = angular.element(masterTemplate[0].cloneNode(true));
      var itemTpl = tpl.children('ul').children('li').children('a').children('span');
      var selectedItemTpl = tpl.children('button').children('span');
      var elementHtml = element.html();
      itemTpl.append(elementHtml);
      selectedItemTpl.append(elementHtml.replace(/\$item\b/g, '$selectedItem'));
      element.empty();
      var compiledTpl = $compile(tpl.clone());
      return function (scope, linkElement, attrs, ngModelCtrl) {
        linkElement.append(compiledTpl(scope));
        scope.$watch(attrs.list, function (list) {
          scope.list = list || [];
        });

        scope.select = function (item) {
          scope.$selectedItem = item;
          ngModelCtrl.$setViewValue(item, true);
        };

        ngModelCtrl.$render = function () {
          scope.$selectedItem = ngModelCtrl.$viewValue;
        };
      };
    }
  };
}]);
/**
 * @ngdoc overview
 * @name a2-on-resize
 * @description
 * Directive for detecting size changes in an element.
 */
angular.module('a2.directive.on-resize', []).service('a2OnResizeService', ["$window", "$rootScope", function ($window, $rootScope) {
  var watchers = [],
      animationFramePending = false;

  function Watcher(element, handler) {
    this.element = element;
    this.handler = handler;
    this.value = null;
    watchers.push(this);
    watch.scheduleAnimationFrame();
  }

  Watcher.prototype.destroy = function () {
    var index = watchers.indexOf(this);

    if (index >= 0) {
      watchers.splice(index, 1);
    }
  };

  function watch() {
    animationFramePending = false;
    var triggered = [];
    watchers.forEach(function (watcher) {
      var width = watcher.element[0].clientWidth;
      var height = watcher.element[0].clientHeight;

      if (!watcher.value || watcher.value.width != width || watcher.value.height != height) {
        watcher.value = {
          width: width,
          height: height
        };
        triggered.push(watcher);
      }
    });

    if (triggered.length) {
      $rootScope.$apply(function () {
        triggered.forEach(function (watcher) {
          try {
            watcher.handler(watcher.value);
          } catch (e) {
            console.error(e);
          }
        });
      });
    }

    watch.scheduleAnimationFrame();
  }

  watch.scheduleAnimationFrame = function () {
    if (watchers.length && !animationFramePending) {
      animationFramePending = true;
      $window.requestAnimationFrame(watch);
    }
  };

  return {
    newWatcher: function (element, handler) {
      return new Watcher(element, handler);
    }
  };
}]).directive('a2OnResize', ["$parse", "a2OnResizeService", function ($parse, a2OnResizeService) {
  return {
    restrict: 'A',
    link: function (scope, element, attr) {
      var onResize = $parse(attr.a2OnResize);
      var watcher = a2OnResizeService.newWatcher(element, function (newSize) {
        onResize(newSize, scope);
      });
      scope.$on('$destroy', function () {
        watcher.destroy();
      });
    }
  };
}]);
/**
 * @ngdoc overview
 * @name a2-palette-drawer
 * @description
 * Directive for drawing a color palette.
 */
angular.module('a2.directive.a2-palette-drawer', []).directive('a2PaletteDrawer', ["a2Soundscapes", function (a2Soundscapes) {
  return {
    restrict: 'E',
    template: '<canvas class="palette"></canvas>',
    replace: true,
    scope: {
      palette: '&'
    },
    link: function ($scope, $element, $attrs) {
      var draw = function () {
        var pal = $scope.palette() || [];
        var e = pal.length | 0;
        $element.attr('width', e);
        $element.attr('height', 1);
        var ctx = $element[0].getContext('2d');

        for (var i = 0; i < e; ++i) {
          ctx.fillStyle = pal[i];
          ctx.fillRect(i, 0, 1, 1);
        }
      };

      $scope.$watch('palette()', draw);
    }
  };
}]);
/**
 * @ngdoc overview
 * @name a2-sidenav
 * @description
 * Directive for specifying a sidenav bar.
 * this bar specifies a list of links that can be added
 * whenever a corresponding sidenavbar anchor resides
 */
angular.module('a2.directive.percentage-bars', ['a2.utils']).directive('a2PercentageBars', ["a2SidenavBarService", "$parse", function (a2SidenavBarService, $parse) {
  return {
    restrict: 'E',
    templateUrl: '/directives/a2-percentage-bars.html',
    scope: {
      data: "=",
      total: "=",
      colors: "="
    },
    controller: 'a2PercentageBarsCtrl as bars'
  };
}]).controller('a2PercentageBarsCtrl', ["$scope", "$filter", function ($scope, $filter) {
  var DEFAULT_COLORS = ['0', '1', '2'];
  var numberFilter = $filter('number');

  $scope.getColorClass = function (index) {
    var colors = $scope.colors || DEFAULT_COLORS;
    return 'bar-' + colors[index % colors.length];
  };

  $scope.getTotal = function () {
    return $scope.total || $scope.data.reduce(function (a, b) {
      return a + b;
    });
  };

  $scope.asPercent = function (value, rounding) {
    return numberFilter(value * 100 / $scope.getTotal(), rounding) + '%';
  };
}]);
angular.module('a2.directive.require-non-empty', []).directive('requireNonEmpty', function () {
  return {
    restrict: 'A',
    require: '?ngModel',
    link: function (scope, elm, attr, ctrl) {
      if (!ctrl) {
        return;
      }

      attr.required = true; // force truthy in case we are on non input element

      ctrl.$validators.required = function (modelValue, viewValue) {
        return !attr.required || !(ctrl.$isEmpty(viewValue) || viewValue instanceof Array && !viewValue.length);
      };

      attr.$observe('required', function () {
        ctrl.$validate();
      });
    }
  };
});
/**
 * @ngdoc overview
 * @name a2-sidenav
 * @description
 * Directive for specifying a sidenav bar.
 * this bar specifies a list of links that can be added
 * whenever a corresponding sidenavbar anchor resides
 */
angular.module('a2.directive.sidenav-bar', ['a2.utils']).directive('a2SidenavBar', ["a2SidenavBarService", "$parse", function (a2SidenavBarService, $parse) {
  return {
    restrict: 'E',
    compile: function (element, attr) {
      element.addClass("sidenav");
      var name = attr.name;
      var template = element.clone();
      return function (scope, element, attr) {
        a2SidenavBarService.enableSidenavBar(name, template, scope);

        if (attr.enabled) {
          scope.$watch(attr.enabled, function (enabled) {
            if (enabled) {
              a2SidenavBarService.enableSidenavBar(name, template, scope);
            } else {
              a2SidenavBarService.disableSidenavBar(name);
            }
          });
        }

        scope.$on('$destroy', function () {
          a2SidenavBarService.disableSidenavBar(name);
        });
      };
    }
  };
}]).service('a2SidenavBarService', ["$q", "$log", "a2EventEmitter", function ($q, $log, a2EventEmitter) {
  var cache = {};

  function SidenavBar() {
    this.enabled = false;
    this.events = new a2EventEmitter();
  }

  SidenavBar.prototype = {
    enable: function (template, scope) {
      if (!this.enabled) {
        this.enabled = true;
        this.template = template;
        this.scope = scope;
        return this.events.emit('enabled', this);
      }

      return $q.resolve();
    },
    disable: function () {
      if (this.enabled) {
        this.enabled = false;
        delete this.template;
        delete this.scope;
        return this.events.emit('disabled', this);
      }

      return $q.resolve();
    },
    on: function (event, listener) {
      this.events.on(event, listener);
    },
    off: function (event, listener) {
      this.events.off(event, listener);
    }
  };

  function getSidenavBar(name) {
    return cache[name] || (cache[name] = new SidenavBar());
  }

  a2SidenavBarService = {
    enableSidenavBar: function (name, template, scope) {
      return getSidenavBar(name).enable(template, scope);
    },
    disableSidenavBar: function (name) {
      return getSidenavBar(name).disable();
    },
    registerAnchor: function (name, onEnabled, onDisabled) {
      var bar = getSidenavBar(name);
      bar.on('enabled', onEnabled);
      bar.on('disabled', onDisabled);

      if (bar.enabled) {
        $q.resolve().then(onEnabled);
      }

      return function unregisterAnchor() {
        bar.off('enabled', onEnabled);
        bar.off('disabled', onDisabled);
      };
    }
  };
  return a2SidenavBarService;
}]).directive('a2SidenavBarAnchor', ["a2SidenavBarService", "$compile", function (a2SidenavBarService, $compile) {
  return {
    restrict: 'A',
    link: function (scope, element, attr) {
      var name;
      var isUl = element[0].nodeName.toLowerCase() == 'ul';
      var unregisterAnchor;

      function onEnabled(sidebar) {
        var template = sidebar.template.clone();
        element.empty().append($compile(template.children())(sidebar.scope));
      }

      function onDisabled(sidebar) {
        element.empty();
      }

      attr.$observe('a2SidenavBarAnchor', function (_name) {
        name = _name;

        if (unregisterAnchor) {
          unregisterAnchor();
          unregisterAnchor = null;
        }

        unregisterAnchor = a2SidenavBarService.registerAnchor(name, onEnabled, onDisabled);
      });
      scope.$on('$destroy', function () {
        if (unregisterAnchor) {
          unregisterAnchor();
          unregisterAnchor = null;
        }
      });
    }
  };
}]);
angular.module('a2.directive.a2-table', []).directive('a2Table', ["$window", "$filter", "$templateCache", "$compile", function ($window, $filter, $templateCache, $compile) {
  var $ = $window.$;

  function compileFields(element) {
    return element.children('field').toArray().map(function (field) {
      field = angular.element(field);
      var clone = field.clone();
      field.detach();
      return {
        title: clone.attr('title'),
        key: clone.attr('key'),
        tdclass: clone.attr('tdclass'),
        width: clone.attr('width'),
        filter: clone.attr('filter') !== undefined ? clone.attr('filter') || clone.attr('key') : undefined,
        content: clone.html(),
        show: clone.attr('show'),
        tooltip: clone.attr('tooltip')
      };
    });
  }

  function compileSelectExpand(element, options) {
    var selectExpand = element.children('expand-select');

    if (!selectExpand.length) {
      return;
    }

    var clone = selectExpand.clone(true);
    selectExpand.detach();
    selectExpand = angular.element('<tr ng-show="selected"><td colspan="' + options.fieldCount + '"></td></tr>');
    selectExpand.find('td').append(clone);
    return selectExpand;
  }

  return {
    restrict: 'E',
    scope: {
      rows: '=',
      selected: '=?',
      // able to work with $scope.selected rows
      onSelect: '&',
      onCheck: '&',
      checked: '=?',
      // able to work with $scope.checked rows
      search: '=?',
      // noCheckbox: '@',    // disable row checkboxes
      // noSelect: '@',      // disable row selection
      dateFormat: '@',
      // moment date format, default: 'lll'
      numberDecimals: '@' // decimal spaces

    },
    controller: 'a2TableCtrl as a2TableController',
    compile: function (element, attrs) {
      var template = angular.element($templateCache.get('/directives/a2-table.html'));
      var tplHead = template.find("thead tr.headers");
      var tplFilters = template.find("thead tr.filters");
      var tplBody = template.find("tbody tr");
      var options = {};
      var filterable = [];
      var hasFilters = false;
      options.fields = compileFields(element);
      options.hasCheckbox = attrs.noCheckbox === undefined;
      options.hasSelection = attrs.noSelect === undefined;
      options.fieldCount = options.fields.length + (options.hasCheckbox ? 1 : 0);
      options.selectExpand = compileSelectExpand(element, options);
      options.fields.forEach(function (field, index) {
        tplHead.append(angular.element('<th ng-click="a2TableController.sortBy(' + index + ')" class="cs-pointer"' + (field && field.tooltip !== undefined ? ' title="' + field.tooltip + '"' : '') + (field && field.show !== undefined ? ' ng-if="' + field.show + '"' : '') + '></th>').addClass(field.tdclass).text(field.title).append(field.key ? '    <i ng-if="sortKey == ' + index + '" class="fa" ng-class="reverse ? \'fa-chevron-up\': \'fa-chevron-down\'"></i>\n' : ''));
        hasFilters |= field.filter !== undefined;
        tplFilters.append(angular.element('<th' + (field && field.show !== undefined ? ' ng-if="' + field.show + '"' : '') + '></th>').append(field.filter !== undefined ? '   <input type="text" class="a2-table-filter form-control" ng-model="a2TableController.filter[' + index + ']" ng-change="a2TableController.onFilterChanged(' + index + ')">\n' : ''));
        tplBody.append(angular.element('<td ' + (['Project', 'Species'].includes(field.title) ? 'title="' + field.content + '"' : '') + (field.width ? 'width="' + field.width + '"' : '') + (field && field.show !== undefined ? ' ng-if="' + field.show + '"' : '') + '>').addClass(field.tdclass).html(field.content));
      });
      return function (scope, element, attrs, a2TableCtrl) {
        var tableScope = scope.$parent.$new(false, scope);
        options.scope = scope;
        options.tableScope = tableScope;

        options.onSelect = scope.onSelect && function (row) {
          return scope.onSelect({
            row: row
          });
        };

        options.onCheck = scope.onCheck && function (row) {
          return scope.onCheck({
            row: row
          });
        };

        a2TableCtrl.initialize(options);
        tableScope.a2TableController = a2TableCtrl;
        a2TableCtrl.fields = options.fields;

        if (options.selectExpand) {
          a2TableCtrl.selectExpand = $compile(options.selectExpand)(tableScope);
        }

        a2TableCtrl.noCheck = !options.hasCheckbox;
        a2TableCtrl.noSelect = !options.hasSelection;
        tableScope.sortKey = attrs.defaultSort || tableScope.sortKey;

        if (attrs.search) {
          scope.$watch('search', function (value) {
            tableScope.query = scope.search;
            a2TableCtrl.updateChecked();
          });
        }

        a2TableCtrl.setRows(scope.rows);
        scope.$watch('rows', function (rows) {
          a2TableCtrl.setRows(rows);
        }, true);
        var cmpel = $compile(template.clone())(tableScope);
        element.append(cmpel);
        scope.$on('$destroy', function () {
          tableScope.$destroy();
        });
      };
    }
  };
}]).controller('a2TableCtrl', ["$filter", function ($filter) {
  var scope, tableScope;

  this.initialize = function (options) {
    scope = options.scope;
    tableScope = options.tableScope;
    this.options = options;
    this.__onSelect = options.onSelect;
    this.__onCheck = options.onCheck;
    this.hasFilters = options.fields.reduce(function (_, field) {
      return _ || field.filter !== undefined;
    }, false);
    this.filter = {};
  };

  this.setRows = function (rows) {
    this.rows = rows;
    this.updateChecked();
  };

  this.onFilterChanged = function (index) {
    var query = tableScope.query || (tableScope.query = {});
    var key = this.options.fields[index].filter.split('.');
    var value = this.filter[index];

    if (value == "") {
      while (key.length > 1) {
        query = (query || {})[key.shift()];
      }

      delete query[key.shift()];
    } else {
      while (key.length > 1) {
        var keycomp = key.shift();
        query = query[keycomp] || (query[keycomp] = {});
      }

      query[key.shift()] = value;
    }
  };

  this.updateChecked = function () {
    if (this.rows) {
      var visible = $filter('filter')(this.rows, tableScope.query);
      scope.checked = visible.filter(function (row) {
        return row.checked | false;
      });
    }
  };

  this.toggleAll = function () {
    var allFalse = this.rows.reduce(function (_, row) {
      return _ && !row.checked;
    }, true);
    this.rows.forEach(function (row) {
      row.checked = allFalse;
    });
    tableScope.checkall = allFalse;
  };

  this.check = function ($event, $index) {
    if (this.lastChecked && $event.shiftKey) {
      if (this.lastChecked) {
        var rows;

        if (this.lastChecked > $index) {
          rows = this.rows.slice($index, this.lastChecked);
        } else {
          rows = this.rows.slice(this.lastChecked, $index);
        }

        rows.forEach(function (row) {
          row.checked = true;
        });
      }
    }

    this.lastChecked = $index;
  };

  this.keyboardSel = function (row, $index, $event) {
    if ($event.key === " " || $event.key === "Enter") {
      this.sel(row, $index);
    }
  };

  this.sel = function (row, $index, $event) {
    if (this.noSelect) {
      return;
    }

    if (tableScope.selected === row) {
      row = undefined;
    }

    tableScope.selected = row;
    scope.selected = row;

    if (this.selectExpand) {
      angular.element($event.currentTarget).after(this.selectExpand);
    }

    if (this.__onSelect) {
      this.__onSelect(row);
    }
  };

  this.onCheck = function (row, $index, $event) {
    if (this.__onCheck) {
      this.__onCheck(row);
    }
  };

  this.sortBy = function (fieldIndex) {
    var field = this.fields[fieldIndex];

    if (tableScope.sortKey !== fieldIndex) {
      tableScope.sortKey = fieldIndex;
      tableScope.sort = field.key;
      tableScope.reverse = false;
    } else {
      tableScope.reverse = !tableScope.reverse;
    }
  };
}]);
(function () {
  var a2TagsModule = angular.module('a2.directive.a2-tags', ['templates-arbimon2']);
  var a2TagTypes = ['classi', 'classes', 'model', 'playlist', {
    tag: 'project',
    linkTo: function (tagId) {
      return "/project/?id=" + tagId;
    }
  }, 'site', 'species', 'song', 'soundscape', 'training_set'];
  a2TagTypes.forEach(function (tagType) {
    if ('string' == typeof tagType) {
      tagType = {
        tag: tagType
      };
    }

    tagType.tcTag = tagType.tag.replace(/(^|\b|-)(\w)/, function (_0, _1, _2) {
      return _2.toUpperCase();
    });
    a2TagsModule.directive('a2Tag' + tagType.tcTag, function ($injector) {
      return {
        restrict: 'EAC',
        scope: {
          tag: '=a2Tag' + tagType.tcTag
        },
        link: function (scope, element, attrs) {
          var tagName, tagId, tagLink;
          var aElement = element.find('a');
          element.addClass('a2-tag a2-tag-' + tagType.tag);
          scope.$watch('tag', function (tag) {
            if (tag instanceof Array) {
              tagId = tag[0];
              tagName = tag[1];

              if (tagId && tagType.linkTo) {
                tagLink = $injector.invoke(tagType.linkTo, null, {
                  tagId: tagId
                });
              }
            } else {
              tagId = null;
              tagName = tag;
            }

            var tagElement = angular.element(tagLink ? '<a></a>' : '<span></span>').appendTo(element.empty());
            tagElement.text(tagName);

            if (tagLink) {
              tagElement.attr('href', tagLink);
            }
          });
        }
      };
    });
  });
})();
angular.module('a2.directives', ['a2.services', 'a2.directive.a2-table', 'arbimon.directive.a2-switch', 'a2.directive.percentage-bars', 'templates-arbimon2']).run(["$window", function ($window) {
  var $ = $window.$;
  $(document).click(function (e) {
    if ($(e.target).closest('.calendar.popup:visible').length) return;
    $('.calendar.popup:visible').hide();
  }); // extend jQuery
  // add parent tag selector

  $.expr.filter.UP_PARENT_SPECIAL = function (_1) {
    var times = _1 && _1.length || 1;
    return $.expr.createPseudo(function (seed, matches, _3, _4) {
      var dups = [];
      seed.forEach(function (e, i) {
        var p = e;

        for (var t = times; t > 0; --t) {
          p = p && (p.nodeType == 9 || p.parentNode.nodeType == 9 ? p : p.parentNode);
        }

        if (p) {
          for (var di = 0, de = dups.length; di < de; ++di) {
            if (dups[di] === p) {
              p = null;
              break;
            }
          }

          if (p) {
            dups.push(p);
          }
        }

        matches[i] = p;
        seed[i] = !p;
      });
      return true;
    });
  };

  $.expr.match.needsContext = new RegExp($.expr.match.needsContext.source + '|^(\\^)');
  $.expr.match.UP_PARENT_SPECIAL = /^(\^+)/;
}]).directive('a2GlobalKeyup', ["$window", "$timeout", function ($window, $timeout) {
  var $ = $window.$;
  return {
    restrict: 'A',
    scope: {
      onkeyup: '&a2GlobalKeyup'
    },
    link: function ($scope, $element, $attrs) {
      var handler = function (evt) {
        $timeout(function () {
          $scope.onkeyup({
            $event: evt
          });
        });
      };

      $(document).on('keyup', handler);
      $element.on('$destroy', function () {
        $(document).off('keyup', handler);
      });
    }
  };
}]).directive('a2Scroll', ["$parse", "$window", function ($parse, $window) {
  var mkFunction = function (scope, attr) {
    var fn = $parse(attr);
    return function (locals) {
      locals.console = console;
      return fn(scope, locals);
    };
  };

  return {
    scope: {
      'a2InfiniteScrollDistance': '=?',
      'a2InfiniteScrollDisabled': '=?',
      'a2InfiniteScrollImmediateCheck': '=?'
    },
    link: function ($scope, element, attrs, controller) {
      var pscope = $scope.$parent;
      var fnBind = 'on';
      var fnUnbind = 'off';

      if (attrs.a2Scroll) {
        controller.a2Scroll = mkFunction(pscope, attrs.a2Scroll);
      }

      controller.element = element;

      if (attrs.a2ScrollOn) {
        if (attrs.a2ScrollOn == 'window') {
          controller.scrollElement = $window;
          fnBind = 'addEventListener';
          fnUnbind = 'removeEventListener';
        } else {
          controller.scrollElement = $(attrs.a2ScrollOn);
        }
      } else {
        controller.scrollElement = element;
      }

      if (attrs.a2InfiniteScroll) {
        $scope.a2InfiniteScroll = mkFunction(pscope, attrs.a2InfiniteScroll);
      }

      if (!$scope.a2InfiniteScrollDistance) {
        $scope.a2InfiniteScrollDistance = 1;
      }

      if (!$scope.a2InfiniteScrollRefraction) {
        $scope.a2InfiniteScrollRefraction = 1000;
      }

      controller.scrollHandler = controller.scrollHandler.bind(controller);
      controller.scrollElement[fnBind]("scroll", controller.scrollHandler);
      controller.element.bind("$destroy", function () {
        controller.scrollElement[fnUnbind]('scroll', controller.scrollHandler);
        controller.dispose();
      });
    },
    controller: 'a2ScrollController'
  };
}]).controller('a2ScrollController', ["$scope", function ($scope) {
  Object.assign(this, {
    anchors: {},
    addAnchor: function (name, anchorElement) {
      this.anchors[name] = anchorElement;
    },
    removeAnchor: function (name) {
      delete this.anchors[name];
    },
    scrollHandler: function (event) {
      try {
        if (this.a2Scroll) {
          this.a2Scroll({
            $event: event,
            $controller: this
          });
        }

        if ($scope.a2InfiniteScroll && !$scope.a2InfiniteScrollDisabled) {
          var remaining = (element[0].scrollHeight - element[0].scrollTop | 0) / element.height();

          if (remaining < $scope.a2InfiniteScrollDistance) {
            var time = new Date().getTime();

            if (!$scope.refraction || $scope.refraction < time) {
              $scope.refraction = time + $scope.a2InfiniteScrollRefraction;
              $scope.a2InfiniteScroll({
                $event: e
              });
            }
          }
        }
      } finally {
        $scope.$apply();
      }
    },
    dispose: function () {
      this.element = null;
      this.scrollElement = null;
      this.anchors = {};
    }
  });
}]).directive('a2ScrollAnchor', function () {
  return {
    require: '^a2Scroll',
    link: function ($scope, element, attrs, a2ScrollController) {
      var name = attrs.name;
      a2ScrollController.addAnchor(name, element);
      element.bind("$destroy", function () {
        a2ScrollController.removeAnchor(name);
      });
    }
  };
}).directive('a2Persistent', ["$rootScope", "$compile", "$timeout", function ($rootScope, $compile, $timeout) {
  var counter = 0;
  var poc = $('<div></div>');
  return {
    restrict: 'E',
    scope: {},
    compile: function (tElement, tAttrs) {
      var children = tElement.children().detach();
      var tag = tAttrs.name || 'persistent-' + counter++;
      return function (_1, $element, _3) {
        if (!$rootScope._$persistence_) {
          $rootScope._$persistence_ = {};
        }

        var p = $rootScope._$persistence_;
        var ptag = p[tag];
        var persisted = true;

        if (!ptag) {
          // console.log('new persistent scope "%s" created in ', tag, $rootScope);
          p[tag] = ptag = {};
          ptag.scope = $rootScope.$new(true);
          ptag.scope._$persistence_tag_ = tag;
          ptag.view = $compile(children)(ptag.scope);
          persisted = false;
        }

        $element.append(ptag.view);
        $element.on('$destroy', function (e) {
          e.stopPropagation();
          poc.append(ptag.view);
        });

        if (persisted) {
          $timeout(function () {
            ptag.scope.$broadcast('a2-persisted');
          });
        }
      };
    }
  };
}]).directive('autoHeight', ["$window", function ($window) {
  var $ = $window.$;
  return {
    restrict: 'A',
    link: function (scope, element, attr) {
      var updateHeight = function () {
        // console.log('window h:', $(window).height());
        // console.log('ele pos:',  element.offset());
        // console.log('ele h:', element.height());
        var h = $($window).height() - element.offset().top;
        if (h < 500) return;
        $window.requestAnimationFrame(function () {
          element.height(h);
        });
      };

      updateHeight();
      $($window).resize(function () {
        updateHeight();
      });
    }
  };
}]).directive('stopClick', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attr) {
      element.bind('click', function (e) {
        e.stopPropagation();
      });
    }
  };
}).directive('loader', function () {
  return {
    restrict: 'E',
    scope: {
      hideText: '@',
      text: '@'
    },
    templateUrl: '/directives/loader.html'
  };
})
/**   yearpick - complete year date picker

  example usage:
  <div class="dropdown">
    <button ng-model="dia" yearpick disable-empty="true" year="year" date-count="dateData">
        <span ng-hide="dia"> Select Date </span>
        {{ dia | date: short }}
    </button>
  </div>
  or, if you just want to show the component :
  <yearpick ng-model="dia" yearpick disable-empty="true" year="year" date-count="dateData"></yearpick>
 */
.directive('yearpick', ["$timeout", "$window", function ($timeout, $window) {
  var d3 = $window.d3;
  var $ = $window.$;
  return {
    restrict: 'AE',
    scope: {
      ngModel: '=',
      maxDate: '=?',
      minDate: '=?',
      year: '=?',
      dateCount: '=?',
      mode: '@',
      onYearChanged: '&?',
      onDateChanged: '&?',
      disableEmpty: '&'
    },
    link: function (scope, element, attrs) {
      var is_a_popup = !/yearpick/i.test(element[0].tagName);
      var popup;

      if (is_a_popup) {
        popup = $('<div></div>').insertAfter(element).addClass('calendar popup');
        element.click(function (e) {
          e.stopPropagation(); // verify if hidden

          var visible = popup.css('display') === 'none'; // always hide any other open yearpick

          $('.calendar.popup:visible').hide();

          if (visible) {
            popup.css('display', 'block');
          }
        });
      } else {
        popup = element.addClass('calendar');
      }

      var weekOfMonth = function (d) {
        var firstDay = new Date(d.toString());
        firstDay.setDate(1);
        var monthOffset = firstDay.getDay() - 1;
        return Math.floor((d.getDate() + monthOffset + 7) / 7) - 1;
      };

      var monthName = d3.time.format('%B');
      var dateFormat = d3.time.format("%Y-%m-%d");

      var format2Date = function (txt) {
        var m = /^(\d+)-(\d+)-(\d+)$/.exec(txt);
        return m && new Date(m[1] | 0, m[2] | 0, m[3] | 0);
      };

      var canHaveDateCounts = function () {
        return scope.mode === "density" && attrs.dateCount;
      };

      var computeMax = !attrs.maxDate;
      var computeMin = !attrs.minDate;

      function setYear(year) {
        var old_year = scope.year;
        scope.year = year;

        if (scope.onYearChanged && old_year != year) {
          $timeout(function () {
            scope.onYearChanged({
              year: year
            });
          });
        }
      }

      function setDate(date) {
        var old_date = scope.ngModel;
        scope.ngModel = date;

        if (scope.onDateChanged && old_date != date) {
          $timeout(function () {
            scope.onDateChanged({
              date: date
            });
          });
        }
      }

      if (!scope.year) {
        setYear(new Date().getFullYear());
      }

      var cubesize = 19;
      var width = 600;
      var height = 510;
      var headerHeight = 40;
      var days;
      var svg = d3.select(popup[0]).append('svg').attr('width', width).attr('height', height);
      var cal = svg.append('g');
      var legend = svg.append('g');
      var prev = svg.append('g').attr('class', 'btn');
      var next = svg.append('g').attr('class', 'btn'); // draws previous year button

      prev.append('text').attr('text-anchor', 'start').attr('font-family', 'FontAwesome').attr('font-size', 24).attr('x', 5).attr('y', 24).text('\uf060');
      prev.on('click', function (e) {
        $timeout(function () {
          setYear(scope.year - 1);
        });
      }); // draws next year button

      next.append('text').attr('text-anchor', 'end').attr('font-family', 'FontAwesome').attr('font-size', 24).attr('x', width - 5).attr('y', 24).text('\uf061');
      next.on('click', function (e) {
        $timeout(function () {
          setYear(scope.year + 1);
        });
      }); // draw legend

      if (scope.mode === "density") {
        var scale = {
          scale: [1, 50, 100],
          labels: ['0', '1', '50', '100']
        };
        var color = d3.scale.threshold().domain(scale.scale).range(scale);
        var icon = legend.selectAll('g').data(['1', '50', '100']).enter().append('g').attr('transform', function (d, i) {
          switch (d) {
            case '50':
              return 'translate(18,0)';

            default:
              return 'translate(20,0)';
          }
        });
        icon.append('rect').attr('width', cubesize * 0.63).attr('height', cubesize * 0.63).attr('y', height + 7 - cubesize).attr('x', function (d, i) {
          return i * 45 + 22;
        }).attr('class', function (d) {
          return 'cal-level-' + d;
        });
        icon.append('text').attr('text-anchor', 'middle').attr('font-size', 10).attr('y', height - 2).attr('x', function (d, i) {
          switch (d) {
            case '1':
              return i * 45 + 11;

            case '50':
              return i * 45 + 9;

            case '100':
              return i * 45 + 6;
          }
        }).text(function (d, i) {
          return '+' + d;
        });
      }

      var drawCounts = function () {
        if (scope.mode === "density" && !scope.dateCount) return;

        if (scope.disableEmpty()) {
          days.classed('day-disabled', function (d) {
            return $(this).hasClass('cal-oor') || !scope.dateCount[dateFormat(d)];
          });
        }

        var squares = days.select('rect');
        squares.attr('class', function (d) {
          var color = d3.scale.threshold().domain([1, 50, 100]).range(['0', '1', '50', '100']);
          var count = scope.dateCount[dateFormat(d)] || 0;
          return 'cal-level-' + color(count);
        });
      };

      var draw = function () {
        // set calendar year
        calendar = cal.selectAll('g').data([scope.year]); // append new year

        var title = calendar.enter().append('g'); // set text position

        title.append('text').attr('text-anchor', 'middle').attr('font-size', 30).attr('x', width / 2).attr('y', 30); // set line position

        title.append('line').attr('x1', 5).attr('y1', headerHeight).attr('x2', width - 5).attr('y2', headerHeight).attr('stroke', 'rgba(0,0,0,0.5)').attr('stroke-width', 1); // remove old year

        calendar.exit().remove(); // write year text

        calendar.select('text').text(function (d) {
          return d;
        });
        prev.classed('disabled', scope.minDate && scope.minDate.getFullYear() >= scope.year);
        next.classed('disabled', scope.maxDate && scope.year >= scope.maxDate.getFullYear()); // setup the months containers and set the years' month date range

        var mon = calendar.append('g').attr('transform', 'translate(0,' + headerHeight + ')').selectAll('g').data(function (d) {
          return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1));
        }); // on enter in months, append new months

        mon.enter().append('g'); // in months, transform each month to their place in the yearpick

        mon.attr('transform', function (d, i) {
          return 'translate(' + (d.getMonth() % 4 * 150 + 5) + ',' + (Math.floor(d.getMonth() / 4) * 150 + 5) + ')';
        }); // in months, transform each month to their place in the yearpick

        mon.append('text').attr('text-anchor', 'middle').attr('x', cubesize * 7 / 2).attr('y', 15).text(function (d) {
          return monthName(d);
        }); // remove old months

        mon.exit().remove(); // setup day containers for each months

        days = mon.selectAll('g').data(function (d) {
          return d3.time.days(new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1));
        }); //  in days, on enter, append a g of class btn

        days.enter().append('g').attr('class', 'day'); //  for each day, move the text, add class hover and onclick event handler

        days.attr('transform', function () {
          return 'translate(0,24)';
        }).classed('hover', true).classed('day-disabled cal-oor', function (d) {
          return (scope.minDate ? d < scope.minDate : false) || (scope.maxDate ? scope.maxDate < d : false);
        }).classed('selected', function (d) {
          return scope.ngModel && dateFormat(d) == dateFormat(scope.ngModel);
        }).on('click', function (d) {
          scope.$apply(function () {
            d3.event.preventDefault();
            setDate(d);
            if (is_a_popup) popup.css('display', 'none');
          });
        }); // .. also, add a rect on the background

        days.append('rect').attr('width', cubesize).attr('height', cubesize).attr('y', function (d, i) {
          return weekOfMonth(d) * (cubesize + 1);
        }).attr('x', function (d, i) {
          return d.getDay() * (cubesize + 1);
        }).attr('fill', 'white'); // .. and append a text on the foreground

        days.append('text').attr('text-anchor', 'middle').attr('font-size', 10).attr('y', function (d, i) {
          return weekOfMonth(d) * (cubesize + 1) + 13;
        }).attr('x', function (d, i) {
          return (d.getDay() + 1) * (cubesize + 1) - 10;
        }).text(function (d, i) {
          return d.getDate();
        }); // if we have date counts, then draw them

        if (attrs.dateCount) {
          drawCounts();
        } // remove old days


        days.exit().remove();
      };

      scope.$watch('maxDate', function () {
        if (scope.maxDate && scope.year > scope.maxDate.getFullYear()) {
          setYear(scope.maxDate.getFullYear());
        }

        draw();
      });
      scope.$watch('minDate', function () {
        if (scope.minDate && scope.year < scope.minDate.getFullYear()) {
          setYear(scope.minDate.getFullYear());
        }

        draw();
      });
      scope.$watch('year', function () {
        if (!scope.year) {
          setYear(new Date().getFullYear());
        }

        draw();
      });
      scope.$watch('ngModel', function () {
        if (scope.ngModel) {
          setYear(scope.ngModel.getFullYear());
          days.classed('selected', function (d) {
            return scope.ngModel && dateFormat(d) == dateFormat(scope.ngModel);
          });
        }
      });

      var computeMaxMinDateFromCounts = function (dateCounts, computeMax, computeMin) {
        var stats = null;

        if (!dateCounts || !computeMax && !computeMin) {
          return;
        }

        for (var dateFmt in dateCounts) {
          var date = format2Date(dateFmt);

          if (stats) {
            stats.min = Math.min(date, stats.min);
            stats.max = Math.max(date, stats.max);
          } else {
            stats = {
              min: date,
              max: date
            };
          }
        }

        if (computeMin) {
          scope.minDate = new Date(stats.min);
        }

        if (computeMax) {
          scope.maxDate = new Date(stats.max);
        }
      };

      if (canHaveDateCounts()) {
        scope.$watch('dateCount', function (value) {
          computeMaxMinDateFromCounts(value, computeMax, computeMin);
          drawCounts();
        });
      }
    }
  };
}]).directive('a2Img', ["$compile", "$window", function ($compile, $window) {
  var $ = $window.$;
  return {
    restrict: 'E',
    scope: {},
    link: function ($scope, $element, $attr) {
      $element.addClass('a2-img');
      var loader = $compile('<loader hide-text="yes"></loader>')($scope).appendTo($element);
      var img = $('<img>').on('load', function () {
        $element.removeClass('loading');
      }).appendTo($element);
      $attr.$observe('a2Src', function (new_src) {
        if (!new_src) {
          img.hide();
          img.attr('src', '');
          return;
        }

        img.show();
        $element.addClass('loading');
        var image = new Image();

        image.onload = function () {
          img.attr('src', this.src);
        };

        image.src = new_src;
      });
    }
  };
}]).directive('a2TrainingSetDataImage', ["$compile", "a2TrainingSets", function ($compile, a2TrainingSets) {
  return {
    restrict: 'E',
    scope: {
      'trainingSet': '=',
      'datum': '='
    },
    template: '<a2-img a2-src="{{datum.uri}}" ng-class="resolving ? \'resolving-uri\' : \'\'" style="width:100%;height:100%;"></a2-img>',
    link: function ($scope, $element, $attr) {
      $element.addClass('a2-training-set-data-image a2-block-inline');

      var resolve_null_uri = function () {
        if ($scope.datum && $scope.trainingSet && !$scope.datum.url) {
          var urikey = [$scope.trainingSet.id, $scope.datum.id].join('-');

          if ($scope.resolving != urikey) {
            $scope.resolving = urikey;
            a2TrainingSets.getDataImage($scope.trainingSet.id, $scope.datum.id, function (datum2) {
              $scope.resolving = false;

              if ($scope.datum.id == datum2.id) {
                $scope.datum.uri = datum2.uri;
              }
            });
          }
        }
      };

      $scope.$watch('datum', resolve_null_uri);
      $scope.$watch('trainingSet', resolve_null_uri);
    }
  };
}]).directive('a2InsertIn', ["$window", function ($window) {
  var $ = $window.$;
  var count = 1;
  return {
    restrict: 'A',
    link: function ($scope, $element, $attr) {
      var anchor = $('<div class="a2-insert-in-anchor"></div>').attr('id', 'a2InsertInAnchor' + count++);

      var is_truthy = function (v) {
        return v && !/no|false|0/.test('' + v);
      };

      var keep_position = is_truthy($attr.a2KeepPosition);
      var target = $($attr.a2InsertIn);
      $element[0].parentNode.replaceChild(anchor[0], $element[0]);
      $element.appendTo(target);
      var reposition_element = null;

      if (keep_position) {
        var comp_pos = function (el) {
          return $(el).offset();
        };

        reposition_element = function () {
          $('.a2-insert-in-anchor');
          var po = comp_pos($element.offsetParent());
          var ao = comp_pos(anchor);
          ao.position = 'absolute';
          ao.top -= po.top;
          ao.left -= po.left;
          $element.css(ao);
        };

        $('.a2-insert-in-anchor').parents().each(function (i, e) {
          var $e = $(e);

          if (!/visible|hidden/.test($e.css('overflow'))) {
            $e.scroll(reposition_element);
          }
        });
        $scope.$watch(function () {
          return anchor.offset();
        }, reposition_element, true);
        reposition_element();
      }

      $scope.$watch(function () {
        return anchor.is(':visible');
      }, function (visibility) {
        $element.css('display', visibility ? 'block' : 'none');
      });
      anchor.on('$destroy', function () {
        $element.remove();
      });
    }
  };
}]).directive('a2LineChart', ["$window", function ($window) {
  var d3 = $window.d3;

  var drawChart = function (data, options) {
    var padding = {
      left: 30,
      right: 10,
      top: 10,
      bottom: 20
    };

    var getY = function (value) {
      return value.y;
    };

    var getX = function (value) {
      return value.x;
    };

    var yMin = d3.min(data, getY);
    var yMax = d3.max(data, getY);
    var tMin = d3.min(data, getX);
    var tMax = d3.max(data, getX);
    var element = options.element;
    var lineColor = options.lineColor || "red";
    var width = options.width,
        height = options.height;
    var xScale = d3.scale.linear().domain([tMin, tMax]).range([padding.left, width - padding.right]);
    var yScale = d3.scale.linear().domain([yMin, yMax]).range([height - padding.bottom, padding.top]);
    var line = d3.svg.line().x(function (d) {
      return xScale(d.x);
    }).y(function (d) {
      return yScale(d.y);
    }).interpolate("linear");
    var symbol = d3.svg.symbol().type('circle');
    var xAxis = d3.svg.axis().scale(xScale).ticks(tMax - tMin);
    var yAxis = d3.svg.axis().scale(yScale).orient('left').ticks(3);
    var svg = element.append('svg').attr('class', "graph").attr('height', height).attr('width', width);
    svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + (height - padding.bottom) + ")").call(xAxis);
    svg.append("g").attr("class", "y axis").attr("transform", "translate(" + padding.left + ",0)").call(yAxis);
    var dataG = svg.append('g').datum(data);
    var path = dataG.append('path').attr('stroke', lineColor).attr('stroke-width', "2").attr('fill', "none").attr('d', line);
    var totalLength = path.node().getTotalLength();
    path.attr("stroke-dasharray", totalLength).attr("stroke-dashoffset", totalLength).transition().delay(200).duration(1000).ease("linear").attr("stroke-dashoffset", 0).each("end", function () {
      path.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
    });
    dataG.append("g").selectAll('path').data(function (d) {
      return d;
    }).enter().append('path').attr('fill', "transparent").attr("transform", function (d) {
      return "translate(" + xScale(d.x) + "," + yScale(d.y) + ")scale(0.7,0.7)";
    }).attr("d", symbol).attr('fill', lineColor).on('mouseenter', function (d) {
      var body = d3.select('body');
      var coords = d3.mouse(body.node());
      var tooltip = body.append('div').datum(d).attr('class', "graph-tooltip").style('top', coords[1] - 10 + 'px').style('left', coords[0] - 10 + 'px').on('mouseleave', function () {
        body.selectAll('.graph-tooltip').remove();
      }).append('p').text(Math.round(d.y * 1000) / 1000);
    });
  };

  return {
    restrict: 'E',
    scope: {
      values: '=',
      height: '@',
      width: '@',
      color: '@?'
    },
    link: function (scope, element, attrs) {
      scope.$watch('values', function () {
        if (!scope.values) return;
        drawChart(scope.values, {
          lineColor: scope.color,
          element: d3.select(element[0]),
          width: Number(scope.width),
          height: Number(scope.height)
        });
      });
    }
  };
}]).directive('c3ChartDisplay', ["$window", function ($window) {
  var c3 = $window.c3;

  function normalize(data) {
    if (typeof data != 'object') {
      return {
        columns: data
      };
    }

    return data;
  }

  var makeChart = function (element, data, axes) {
    var celem = element.find('div');

    if (!data || !axes) {
      celem.remove();
      return;
    }

    if (!celem.length) {
      celem = angular.element('<div></div>').appendTo(element);
    }

    var args = {
      bindto: celem[0],
      data: normalize(data)
    };

    if (axes) {
      args.axis = axes;
    }

    return c3.generate(args);
  };

  return {
    restrict: 'E',
    scope: {
      data: '=',
      axes: '='
    },
    template: '<span></span>',
    link: function (scope, element, attrs) {
      var chart;
      scope.$watch('axes', function (o, n) {
        if (!chart || o != n) chart = makeChart(element, scope.data, scope.axes, chart);
      });
      scope.$watch('data', function (o, n) {
        if (!chart || o != n) {
          chart = makeChart(element, scope.data, scope.axes, chart);
        } else if (chart) {
          // chart.unload();
          chart.load(normalize(scope.data));
        }
      });
    }
  };
}]).directive('a2Info', function () {
  return {
    replace: true,
    restrict: 'E',
    template: '<i class="text-info fa fa-info-circle"></i>'
  };
}).directive('a2BsNgModelOnDirtySaveButton', ["$parse", function ($parse) {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function (scope, element, attrs, ngModel) {
      var saveBtn;
      var onDirtySaveFN = $parse(attrs.a2BsNgModelOnDirtySaveButton);

      function addSaveBtn() {
        element.wrap('<div class="input-group"></div>');
        var parentEl = element.parent();
        saveBtn = angular.element('<div class="input-group-btn">' + '    <button class="btn btn-primary"><i class="fa fa-save"></i></button>' + '</div>');
        saveBtn.find('button.btn').on('click', function () {
          onDirtySaveFN(scope, {
            $name: ngModel.$name,
            $modelValue: ngModel.$modelValue,
            $setPristine: function () {
              ngModel.$setPristine();
              removeSaveBtn();
            }
          });
        });
        saveBtn.appendTo(parentEl);
      }

      function removeSaveBtn() {
        if (saveBtn) {
          saveBtn.remove();
        }

        element.unwrap();
        saveBtn = undefined;
      }

      ngModel.$viewChangeListeners.push(function () {
        if (ngModel.$dirty && !saveBtn) {
          addSaveBtn();
        } else if (saveBtn) {
          removeSaveBtn();
        }
      });
    }
  };
}]).factory('canvasObjectURL', ["$window", "$q", function ($window, $q) {
  var createObjectURL = $window.URL.createObjectURL;
  var revokeObjectURL = $window.URL.revokeObjectURL;

  if (!createObjectURL && $window.webkitURL.createObjectURL) {
    createObjectURL = $window.webkitURL.createObjectURL;
    revokeObjectURL = $window.webkitURL.revokeObjectURL;
  }

  if (!createObjectURL) {
    revokeObjectURL = function () {};
  }

  function dataURIToBinaryBuffer(dataURI) {
    var BASE64_MARKER = ';base64,';
    var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    var base64 = dataURI.substring(base64Index);
    var raw = $window.atob(base64);
    var rawLength = raw.length;
    var array = new $window.Uint8Array(new $window.ArrayBuffer(rawLength));

    for (i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }

    return array.buffer;
  }

  function getCanvasBlob(canvas) {
    if (canvas.toBlob) {
      return $q(function (resolve) {
        canvas.toBlob(resolve);
      });
    } else {
      var data = dataURIToBinaryBuffer(canvas.toDataURL("image/png"));
      var blob;
      var BlobBuilder = $window.BlobBuilder || $window.WebKitBlobBuilder;

      if (BlobBuilder) {
        var bb = new WebKitBlobBuilder();
        bb.append(data);
        blob = bb.getBlob("image/png");
      } else {
        blob = new $window.Blob([data], {
          type: 'image/png'
        });
      }

      return $q.resolve(blob);
    }
  }

  return {
    create: function (canvas) {
      if (!createObjectURL) {
        return $q.resolve(canvas.toDataURL("image/png"));
      }

      return getCanvasBlob(canvas).then(function (blob) {
        return createObjectURL(blob);
      });
    },
    revoke: revokeObjectURL
  };
}]).directive('axis', ["canvasObjectURL", "$q", "$debounce", function (canvasObjectURL, $q, $debounce) {
  var promiseCache = {};
  var canvas = angular.element('<canvas></canvas>')[0];

  function computeHash(w, h, type, data) {
    return JSON.stringify([w, h, type, data]);
  }

  function createAxisData(canvas, w, h, type, data) {
    if (!w || !h) {
      return $q.reject("Empty canvas size");
    }

    canvas.width = w;
    canvas.height = h;
    var i;
    var prec = data.prec || 1;
    var min = (data.range[0] / prec | 0) * prec;
    var max = (data.range[1] / prec | 0) * prec;
    var scale;
    var unit = data.unit;
    var count = data.count || 1;
    var dTick = (((max - min) / prec | 0) / count | 0) * prec;
    var ctx = canvas.getContext('2d');
    var w1 = w - 1,
        h1 = h - 1; // var compStyle = getComputedStyle(canvas);

    ctx.font = data.font;
    ctx.strokeStyle = data.color;
    ctx.lineWidth = 0.5;
    ctx.clearRect(0, 0, w, h);
    var val,
        x,
        y,
        pad = 3;
    var lblSize = {
      w: 0,
      h: 10
    };
    var loopCt = data.loopCt || 250;

    for (val = min; loopCt > 0 && val < max; val += dTick, --loopCt) {
      var tW = ctx.measureText(val + unit).width;

      if (lblSize.w < tW) {
        lblSize.w = tW;
      }
    }

    if (type == 'h') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      scale = w / (max - min);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w1, 0);
      ctx.stroke();
      loopCt = data.loopCt || 250;

      for (val = min; loopCt > 0 && val < max; val += dTick, --loopCt) {
        x = scale * (val - min);

        if (val >= max - dTick) {
          ctx.textAlign = 'right';
        }

        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, 0);
        ctx.stroke();
        ctx.strokeText(val + unit, x, pad);
      }
    } else if (type == 'v') {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabet';
      scale = h / (max - min);
      ctx.beginPath();
      ctx.moveTo(w1, 0);
      ctx.lineTo(w1, h1);
      ctx.stroke();
      loopCt = data.loopCt || 250;

      for (val = min; loopCt > 0 && val < max; val += dTick, --loopCt) {
        y = h - scale * (val - min);

        if (val >= max - dTick) {
          ctx.textBaseline = 'top';
        }

        ctx.beginPath();
        ctx.moveTo(w1 - pad, y);
        ctx.lineTo(w1, y);
        ctx.stroke();
        ctx.strokeText(val + unit, lblSize.w, y, w1 - pad - 1);
      }
    } // {
    //     range:[0, recording.sample_rate/2000],
    //     count:10,
    //     unit:'kHz'
    // }
    // console.log("drawAxis(",canvas, w, h, type, data,")");


    return canvasObjectURL.create(canvas); // return canvas.toDataURL();
  }

  function drawAxisOnImg(img, w, h, type, data) {
    var hash = computeHash(w, h, type, data);
    var axisDataPromise = promiseCache[hash];

    if (!axisDataPromise) {
      axisDataPromise = promiseCache[hash] = createAxisData(canvas, w, h, type, data);
    }

    return axisDataPromise.then(function (axisData) {
      img.src = axisData;
    });
  }

  return {
    restrict: 'E',
    template: '<img />',
    scope: {
      type: "@",
      data: "="
    },
    link: function (scope, element, attrs) {
      var img = element.find('img')[0];
      var tout;
      var redrawAxis = $debounce(function () {
        drawAxisOnImg(img, element.width(), element.height(), scope.type, scope.data);
      }, 500);

      function elementSize() {
        return element.width() * element.height();
      }

      scope.$watch(elementSize, redrawAxis);
      scope.$watch('type', redrawAxis);
      scope.$watch('data', redrawAxis);
    }
  };
}]).filter('consoleLog', function () {
  return function (x, type) {
    console[type || 'log'](x);
    return x;
  };
}).filter('mouseEventContainerPercent', function () {
  return function ($event, selector) {
    var target = angular.element($event.currentTarget);

    if (selector) {
      target = target.closest(selector);
    }

    var targetpos = target.offset();
    var px = ($event.pageX - targetpos.left) / target.width();
    var py = ($event.pageY - targetpos.top) / target.height();
    return {
      x: px,
      y: py
    };
  };
}).directive('onErrorSrc', function () {
  return {
    link: function (scope, element, attrs) {
      element.bind('error', function () {
        if (attrs.src != attrs.onErrorSrc) {
          attrs.$set('src', attrs.onErrorSrc);
        }
      });
    }
  };
});
angular.module('a2.forms', ['templates-arbimon2']).run(["$window", function ($window) {
  // load zxcvbn 
  var loadZXCVBN = function () {
    var a, b;
    b = $window.document.createElement("script");
    b.src = "/includes/zxcvbn/zxcvbn.js";
    b.type = "text/javascript";
    b.async = !0;
    a = $window.document.getElementsByTagName("script")[0];
    return a.parentNode.insertBefore(b, a);
  };

  if ($window.attachEvent) $window.attachEvent("onload", loadZXCVBN);else $window.addEventListener("load", loadZXCVBN, !1);
}]).directive('passwordInput', ["$window", function ($window) {
  return {
    restrict: 'E',
    scope: {
      password: '=ngModel',
      // password
      validation: '=',
      // validation object
      userInputs: '=?' // array of strings to test password (username, name, lastname, etc)

    },
    templateUrl: '/directives/password-input.html',
    controller: ["$scope", function ($scope) {
      $scope.requiredScore = 2;
      $scope.minLength = 6;
      $scope.maxLength = 32;
      $scope.validation = getValidation();

      function getValidation() {
        return $scope.validation || ($scope.validation = {
          confirm: null,
          result: {},
          valid: false,
          msg: ''
        });
      }

      if (!$scope.userInputs) {
        $scope.userInputs = [];
      }

      $scope.testConfirm = function () {
        var validation = getValidation();
        validation.result.confirm = null;

        if (!validation.result.pass || !$scope.password) {
          return;
        } else if (validation.result.pass.score < $scope.requiredScore) {
          $scope.validation.msg = 'password need to be stronger';
          return;
        }

        if ($scope.password === validation.confirm) {
          validation.result.confirm = {
            ok: true
          };
          validation.valid = true;
          validation.msg = '';
        } else {
          validation.result.confirm = {
            err: "Passwords do not match"
          };
          validation.msg = validation.result.confirm.err;
        }
      };

      $scope.testPass = function () {
        var validation = getValidation(); // wait for zxcvbn library to be available

        if (typeof $window.zxcvbn === 'undefined') {
          if ($scope.waitForZxcvbn) return;
          $scope.waitForZxcvbn = $interval(function () {
            if (typeof $window.zxcvbn !== 'undefined') {
              $interval.cancel($scope.waitForZxcvbn);
              $scope.testPass();
            }
          }, 500);
          return;
        }

        if ($scope.waitForZxcvbn) {
          $interval.cancel($scope.waitForZxcvbn);
        }

        validation.result.pass = null;
        var colors = ['#da3939', '#da3939', '#84b522', '#62b522', '#31b523'];
        var mesgs = ['Very Weak', 'Weak', 'Average', 'Strong', 'Very strong'];

        if (!$scope.password) {
          return;
        } else if ($scope.password.length < 6 || $scope.password.length > 32) {
          var size = $scope.password.length < 6 ? 'short' : 'long';
          validation.result.pass = {
            shields: [],
            color: colors[0],
            msg: 'Password is too ' + size + ', 6-32 characters'
          };
          $scope.validation.msg = validation.result.pass.msg;
        } else {
          var test = $window.zxcvbn($scope.password, $scope.userInputs);
          validation.result.pass = {
            score: test.score,
            shields: new Array(test.score + 1),
            color: colors[test.score],
            msg: mesgs[test.score]
          };
          $scope.testConfirm();
        }
      };
    }]
  };
}]).directive('projectForm', function () {
  return {
    restrict: 'E',
    scope: {
      project: '=ngModel',
      // password
      valid: '=' // validation object

    },
    templateUrl: '/directives/project-form.html',
    controllerAs: 'controller',
    controller: ["$scope", function ($scope) {
      var urlPattern = /^[a-z0-9]+([-_][a-z0-9]+)*$/i;
      this.deriveUrlFromName = true;

      this.nameChanged = function () {
        if (this.deriveUrlFromName) {
          $scope.project.url = ($scope.project.name || '').replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g, '-').replace(/(^-)|(-$)/g, '').replace(/[A-Z]/g, function (_1) {
            return _1.toLowerCase();
          });
        }

        $scope.verify();
      };

      this.urlChanged = function () {
        this.deriveUrlFromName = false;
        $scope.verify();
      };

      $scope.verify = function () {
        var good = true;
        $scope.errorName = '';
        $scope.errorUrl = ''; // check name

        if (!$scope.project.name) {
          good = false;
        } else if ($scope.project.name.length < 6 && $scope.project.name.length > 0) {
          $scope.errorName = 'Name too short, 6 or more characters required';
          good = false;
        } else if ($scope.project.name.length > 50) {
          $scope.errorName = 'Name too long, 50 characters max';
          good = false;
        } //check URL


        if (!$scope.project.url) {
          good = false;
        } else if (!urlPattern.test($scope.project.url)) {
          $scope.errorUrl = 'Invalid project URL alphanumeric characters ' + 'separated by dash(-) or underscore(_)';
          good = false;
        } else if ($scope.project.url.length < 6) {
          $scope.errorUrl = 'URL too short, 6 or more alphanumeric characters ' + 'separated by dash(-) or underscore(_)';
          good = false;
        } else if ($scope.project.url.length > 50) {
          $scope.errorUrl = 'URL too long, 50 characters max';
          good = false;
        }

        $scope.valid = good;
        return good;
      };

      if ($scope.project) {
        $scope.verify();
      } else {
        $scope.project = {
          is_private: 1
        };
        $scope.valid = false;
      }

      $scope.$watch('project', function () {
        $scope.verify();
      });
    }]
  };
});
angular.module('a2.qr-js', []).directive('a2QrCode', ["$window", function ($window) {
  var qr = $window.qr;
  var $ = $window.$;
  return {
    restrict: 'E',
    scope: {
      data: '@'
    },
    link: function ($scope, $element, $attr) {
      var canvas = $('<canvas></canvas>').appendTo($element);
      $attr.$observe('data', function (data) {
        qr.canvas({
          canvas: canvas[0],
          size: 10,
          level: 'Q',
          value: data
        });
      });
    }
  };
}]);
angular.module('c3-charts', []).directive('c3Chart', ["$window", function ($window) {
  return {
    restrict: 'E',
    scope: {
      columns: '='
    },
    link: function (scope, element, attrs) {
      console.log('corri');
      $window.chart = scope.chart = $window.c3.generate({
        bindto: element[0],
        size: {
          width: attrs.width,
          height: attrs.height
        },
        tooltip: {
          show: false
        },
        data: {
          columns: scope.columns || [],
          type: attrs.type
        }
      });
      scope.$watch('columns', function () {
        if (scope.columns) {
          scope.chart.load({
            columns: scope.columns || []
          });
        }
      });
    }
  };
}]);
angular.module('a2.directive.error-message', []).directive('errorMessage', ["$http", "$window", function ($http, $window) {
  var message = '';
  return {
    templateUrl: '/directives/error-message.html',
    restrict: 'E',
    replace: true,
    scope: {
      message: "="
    },
    link: function ($scope) {
      message = $scope.message;
    }
  };
}]);
angular.module('a2.directive.frequency_filter_range_control', []).directive('a2VisualizerFrequencyFilterRangeControl', function () {
  return {
    restrict: 'E',
    templateUrl: '/directives/frequency_filter_range_control.html',
    scope: {
      imgSrc: "=",
      filterMin: "=",
      filterMax: "=",
      maxFreq: "="
    },
    link: function (scope, element, attrs) {
      'use strict';

      var pressed;
      var container = element.find('.a2-audio-freq-filter-component');

      function detectMouseUp(event) {
        pressed = undefined;
        angular.element(document).off('mousemove', detectMouseMove);
      }

      function detectMouseDown(event) {
        var btn = event.buttons === undefined ? event.which : event.buttons;

        if (btn == 1) {
          pressed = event.target;
          angular.element(document).on('mousemove', detectMouseMove);
        }
      }

      function detectMouseMove(event) {
        if (pressed) {
          var m = /bottom|top/.exec(pressed.className);

          if (m) {
            var eloff = container.offset();
            var y = event.pageY - eloff.top;
            var ammount = scope.maxFreq * Math.max(0, Math.min(1 - y / pressed.parentNode.clientHeight, 1));
            ammount = (ammount / 100 | 0) * 100; // cast to int and quantize

            var attr = m[0] == 'top' ? 'filterMax' : 'filterMin';
            scope[attr] = ammount;

            if (scope.filterMin > scope.filterMax) {
              scope.filterMax = ammount;
              scope.filterMin = ammount;
            }

            scope.$apply();
          }
        }
      }

      container.find('button').on('mousedown', detectMouseDown);
      container.on('mousemove', function (event) {});
      angular.element(document).on('mouseup', detectMouseUp);
      element.on('$destroy', function () {
        angular.element(document).off('mouseup', detectMouseUp);
        angular.element(document).off('mousemove', detectMouseMove);
      });
    }
  };
});
angular.module('g-recaptcha', []).directive('gRecaptcha', ["$interval", "$timeout", "$window", function ($interval, $timeout, $window) {
  return {
    restrict: "A",
    scope: {
      sitekey: '@',
      theme: '@?',
      type: '@?',
      response: '=',
      // readonly captchaResponse 
      resetWidget: '=?' // readonly method to reset the widget

    },
    link: function (scope, element, attr) {
      var waitForRecaptcha = $interval(function () {
        if (typeof $window.grecaptcha !== 'undefined') {
          $interval.cancel(waitForRecaptcha);
          var grecaptcha = $window.grecaptcha;
          scope.widgetId = grecaptcha.render(element[0], {
            sitekey: scope.sitekey,
            theme: scope.theme,
            type: scope.type,
            callback: function (response) {
              scope.response = response;
              scope.$apply();
              scope.resetTimeout = $timeout(function () {
                grecaptcha.reset(scope.widgetId);
              }, 30000);
            }
          });

          scope.resetWidget = function () {
            if (scope.resetTimeout) {
              $timeout.cancel(scope.resetTimeout);
            }

            grecaptcha.reset(scope.widgetId);
          };
        }
      }, 500);
    }
  };
}]);
angular.module('a2.directive.news-feed-item', ['a2.srv.news', 'templates-arbimon2', 'a2.directive.a2-tags', 'a2.filter.time-from-now']).directive('newsFeedItem', ["a2NewsService", "$compile", function (a2NewsService, $compile) {
  function parseFormat(format) {
    var RE_INTERP = /%\((\w+)\)s/g;
    var interpolate = [],
        m;
    var lastidx,
        matchidx,
        startidx = 0; // jshint -W084

    while (m = RE_INTERP.exec(format)) {
      lastidx = startidx;
      matchidx = RE_INTERP.lastIndex - m[0].length;

      if (lastidx < matchidx) {
        interpolate.push(format.substr(lastidx, matchidx - lastidx));
      }

      interpolate.push("<span a2-tag-" + m[1] + "=\"news.data." + m[1] + "\" ></span>");
      startidx = RE_INTERP.lastIndex;
    }

    if (startidx < format.length) {
      interpolate.push(format.substr(startidx));
    }

    return '<span>' + interpolate.join('') + '</span>';
  }

  var parsedFormatsPromise = a2NewsService.loadFormats().then(function (formats) {
    return Object.keys(formats).reduce(function (_, i) {
      _[i] = parseFormat(formats[i]);
      return _;
    }, {});
  });
  return {
    restrict: 'EAC',
    scope: {
      news: '=newsFeedItem'
    },
    templateUrl: '/directives/news-feed-item.html',
    link: function (scope, element, attrs) {
      var message = element.find('.message');
      scope.$watch('news', function (news) {
        parsedFormatsPromise.then(function (parsedFormats) {
          message.empty().append($compile(parsedFormats[news.type])(scope));
        });
      });
    }
  };
}]);
angular.module('a2.directive.plotly-plotter', ['a2.directive.on-resize', 'a2.service.plotly-defaults', 'a2.service.plotly-plot-maker']).directive('plotlyPlotter', ["$window", "a2OnResizeService", "PlotlyDefaults", "plotlyPlotMaker", function ($window, a2OnResizeService, PlotlyDefaults, plotlyPlotMaker) {
  return {
    restrict: 'E',
    scope: {
      layout: '=?',
      data: '=?'
    },
    link: function (scope, element, attrs) {
      function mergeData(data) {
        return plotlyPlotMaker.mergeData(data, PlotlyDefaults);
      }

      function mergeLayout(layout) {
        return plotlyPlotMaker.mergeLayout(layout, PlotlyDefaults);
      }

      Plotly.newPlot(element[0], mergeData(scope.data), mergeLayout(scope.layout), PlotlyDefaults.config);
      var resizeWatcher = a2OnResizeService.newWatcher(element, function (newSize) {
        Plotly.relayout(element[0], newSize);
      });

      if (attrs.layout) {
        scope.$watch('layout', function (layout, old) {
          if (layout && layout != old) {
            Plotly.relayout(element[0], mergeLayout(layout));
          }
        });
      }

      if (attrs.data) {
        scope.$watch('data', function (data, old) {
          if (data && data != old) {
            // Plotly.purge(element[0]);
            console.log("Plotly plot data ::", data, scope.layout);
            Plotly.newPlot(element[0], mergeData(scope.data), mergeLayout(scope.layout), PlotlyDefaults.config);
          }
        });
      }

      scope.$on('$destroy', function () {
        resizeWatcher.destroy();
      });
    }
  };
}]);
angular.module('a2.directive.search-bar', []).directive('searchBar', ["$http", "$window", function ($http, $window) {
  var q = '';
  var projectsLoading;
  var projects = [];
  return {
    templateUrl: '/directives/search-bar.html',
    restrict: 'E',
    scope: {
      projectsLoading: "=?",
      q: "=?",
      isUnsafe: "@"
    },
    link: function ($scope) {
      $scope.q = q;
      $scope.projectsLoading = projectsLoading;
      $scope.projects = projects;

      $scope.findProject = function () {
        var config = {
          params: {
            publicTemplates: true
          }
        };

        if ($scope.q !== '') {
          config.params.q = $scope.q;
        }

        $scope.projectsLoading = true;
        return $http.get('/legacy-api/user/projectlist', config).then(function (result) {
          $scope.projectsLoading = false;
          $scope.projects = result.data;
          return result.data;
        });
      };

      $scope.selectProject = function () {
        if (!$scope.q || $scope.q && !$scope.q.is_enabled) {
          return;
        }

        $window.location.assign('/project/' + $scope.q.url + '/');
      };
    }
  };
}]);
angular.module('arbimon2.directive.validation-dropdown', []).directive('validationDropdown', function () {
  var empty_option = {
    label: undefined,
    val: undefined
  };
  var val_options = [{
    label: "Clear",
    val: 2
  }, {
    label: "Present",
    val: 1
  }, {
    label: "Absent",
    val: 0
  }];
  var by_val = val_options.reduce(function (_, option) {
    _[option.val] = option;
    return _;
  }, {});
  return {
    templateUrl: '/directives/validation-dropdown.html',
    require: 'ngModel',
    scope: {},
    link: function (scope, element, attrs, ngModelCtrl) {
      scope.options = val_options;

      function updateLabel(val) {
        var option = val < 2 && by_val[val] ? by_val[val] : empty_option;
        scope.val = option.val;
        scope.label = option.label;
      }

      scope.select = function (val) {
        updateLabel(val);
        ngModelCtrl.$$lastCommittedViewValue = undefined;
        ngModelCtrl.$modelValue = undefined;
        ngModelCtrl.$setViewValue(val, true);
      };

      ngModelCtrl.$render = function () {
        updateLabel(ngModelCtrl.$viewValue);
      };
    }
  };
});
angular.module('a2.directive.warning-banner', []).directive('warningBanner', ["$http", "$window", function ($http, $window) {
  var message = 0;
  return {
    templateUrl: '/directives/warning-banner.html',
    restrict: 'E',
    replace: true,
    scope: {
      message: "="
    },
    link: function ($scope) {
      message = $scope.message;
    }
  };
}]);
angular.module('a2.googlemaps', []).provider("a2GoogleMapsLoader", function () {
  var defer;
  var apiKey;

  function loadScript($window, $q) {
    if (!defer) {
      return;
    }

    var cb_name = 'gmcb';

    while ($window[cb_name]) {
      cb_name += '_';
    }

    $window[cb_name] = function () {
      defer.resolve($window.google);
    };

    var script = $window.document.createElement('script');
    var params = ['callback=' + cb_name];

    if (apiKey) {
      params.push('key=' + apiKey);
    }

    script.src = $window.document.location.protocol + '//maps.googleapis.com/maps/legacy-api/js?' + params.join('&');
    $window.document.body.appendChild(script);
  }

  return {
    setAPIKey: function (key) {
      apiKey = key;
    },
    $get: ["$window", "$q", function ($window, $q) {
      if (!defer) {
        defer = $q.defer();
        loadScript($window, $q);
      }

      return defer.promise;
    }]
  };
});
angular.module('a2.heremaps', []).constant('a2HereMarkerTextIconTemplate', '<div class="map-marker">' + '<svg xmlns="http://www.w3.org/2000/svg" width="28px" height="36px">' + '<path d="M 19 31 C 19 32.7 16.3 34 13 34 C 9.7 34 7 32.7 7 31 C 7 29.3 9.7 28 13 28 C 16.3 28 19 29.3 19 31 Z" fill="#000" fill-opacity=".2"/>' + '<path d="M 13 0 C 9.5 0 6.3 1.3 3.8 3.8 C 1.4 7.8 0 9.4 0 12.8 C 0 16.3 1.4 19.5 3.8 21.9 L 13 31 L 22.2 21.9 C 24.6 19.5 25.9 16.3 25.9 12.8 C 25.9 9.4 24.6 6.1 22.1 3.8 C 19.7 1.3 16.5 0 13 0 Z" fill="#fff"/>' + '<path d="M 13 2.2 C 6 2.2 2.3 7.2 2.1 12.8 C 2.1 16.1 3.1 18.4 5.2 20.5 L 13 28.2 L 20.8 20.5 C 22.9 18.4 23.8 16.2 23.8 12.8 C 23.6 7.07 20 2.2 13 2.2 Z" fill="#18d"/>' + '</svg>' + '<span>${text}</span>' + '</div>').provider("a2HereMapsLoader", ["a2HereMarkerTextIconTemplate", function (a2HereMarkerTextIconTemplate) {
  var loadPromise;
  var appId;
  var appCode;

  function loadScript($window, $q) {
    function loadOneScript(src) {
      return $q(function (resolve, reject) {
        var script = $window.document.createElement('script');
        script.src = $window.document.location.protocol + src;
        script.addEventListener('load', resolve);
        script.addEventListener('error', reject);
        $window.document.body.appendChild(script);
      });
    }

    return loadOneScript("//js.api.here.com/v3/3.0/mapsjs-core.js").then(function () {
      return $q.all([loadOneScript("//js.api.here.com/v3/3.0/mapsjs-service.js"), loadOneScript("//js.api.here.com/v3/3.0/mapsjs-ui.js"), loadOneScript("//js.api.here.com/v3/3.0/mapsjs-mapevents.js")]);
    }).then(function () {
      var api = $window.H;
      return {
        api: api,
        makeTextIcon: function (text) {
          return new H.map.DomIcon(a2HereMarkerTextIconTemplate.replace('${text}', text));
        },
        platform: new api.service.Platform({
          app_id: appId,
          app_code: appCode,
          useHTTPS: /https/.test($window.document.location.protocol)
        })
      };
    });
  }

  return {
    setAPIIdAndCode: function (id, code) {
      appId = id;
      appCode = code;
    },
    $get: ["$window", "$q", function ($window, $q) {
      if (!loadPromise) {
        loadPromise = loadScript($window, $q);
      }

      return loadPromise;
    }]
  };
}]);
angular.module('a2.permissions', ['a2.services', 'ng-permissions']).run(["$rootScope", "a2UserPermit", function ($rootScope, a2UserPermit) {
  $rootScope.userPermit = a2UserPermit;
}]).service('a2UserPermit', ["$http", "Project", "$q", "permits", function ($http, Project, $q, permits) {
  var permit = permits;
  return {
    all: permit.permissions,
    isSuper: function () {
      return permit.super;
    },
    isRfcx: function () {
      return permit.rfcxUser;
    },
    isAuthorized: function () {
      return permit.isAuthorized;
    },
    isProjectMember: function () {
      return permit.isAuthorized && (permit.permissions && permit.permissions.length > 0 || permit.super || permit.rfcxUser);
    },
    getUserEmail: function () {
      return permit.userEmail;
    },
    has: function (feature) {
      return permit.features && permit.features[feature];
    },
    can: function (perm) {
      var allowed;

      if (permit.permissions) {
        allowed = (Array.isArray(perm) ? perm : [perm]).reduce(function (_, perm) {
          return _ && permit.permissions.indexOf(perm) !== -1;
        }, true);
      }

      return allowed || permit.super;
    }
  };
}]);
angular.module('a2.utils-browser-metrics', []).service('a2BrowserMetrics', function () {
  var metrics = {};
  var css = {
    "border": "none",
    "height": "200px",
    "margin": "0",
    "padding": "0",
    "width": "200px"
  };
  var inner = $("<div>").css($.extend({}, css));
  var outer = $("<div>").css($.extend({
    "left": "-1000px",
    "overflow": "scroll",
    "position": "absolute",
    "top": "-1000px"
  }, css)).append(inner).appendTo("body").scrollLeft(1000).scrollTop(1000);
  metrics.scrollSize = {
    height: outer.offset().top - inner.offset().top | 0,
    width: outer.offset().left - inner.offset().left | 0
  };
  outer.remove();
  return metrics;
});
angular.module('a2.utils', ['a2.utils-browser-metrics']).factory('$templateFetch', ["$http", "$templateCache", function ($http, $templateCache) {
  return function $templateFetch(templateUrl, linker) {
    var template = $templateCache.get(templateUrl);

    if (template) {
      if (template.promise) {
        template.linkers.push(linker);
      } else {
        linker(template);
      }
    } else {
      var tmp_promise = {
        linkers: [linker],
        promise: $http.get(templateUrl).success(function (template) {
          $templateCache.put(templateUrl, template);

          for (var i = 0, l = tmp_promise.linkers, e = l.length; i < e; ++i) {
            l[i](template);
          }
        })
      };
      $templateCache.put(templateUrl, tmp_promise);
    }
  };
}]).factory('a2EventEmitter', ["$q", function ($q) {
  function a2EventEmitter() {
    this.list = {};
  }

  a2EventEmitter.prototype = {
    on: function (event, callback) {
      var list = this.list[event] || (this.list[event] = []);
      list.push(callback);
      return callback;
    },
    off: function (event, callback) {
      var list = this.list[event];

      if (list) {
        var idx = list.indexOf(callback);

        if (idx) {
          list.splice(idx, 1);
        }
      }
    },
    emit: function (event) {
      var args = Array.prototype.slice.call(arguments, 1);
      var list = this.list[event];

      if (list) {
        for (var i = 0, e = list.length; i < e; ++i) {
          list[i].apply(null, args);
        }
      }

      return $q.resolve();
    }
  };
  return a2EventEmitter;
}]).factory('itemSelection', function () {
  return {
    make: function make_itemSelection_obj(item_name) {
      var sel = {};

      if (typeof item_name == 'undefined') {
        item_name = 'value';
      }

      sel[item_name] = null;

      sel.select = function (newValue) {
        sel[item_name] = newValue;
      };

      return sel;
    }
  };
}) // display localtime formated by momentjs
.filter('moment', function () {
  return function (input, fmt) {
    if (!input) return undefined;
    return moment(input).format(fmt);
  };
}) // display UTC formated by momentjs
.filter('momentUtc', function () {
  return function (x, fmt) {
    if (!x) return undefined;
    return moment(x).utc().format(fmt);
  };
}) // display site localtime formated by momentjs
.filter('momentTz', function () {
  return function (x, fmt, timezone) {
    if (!x) {
      return undefined;
    }

    return moment.tz(x, timezone).format(fmt);
  };
}) // divides array of into pages of limitPerPage size
.filter('paginate', function () {
  return function (arr, currentPage, limitPerPage) {
    if (!arr) return undefined;
    return arr.slice((currentPage - 1) * limitPerPage, currentPage * limitPerPage);
  };
})
/** Pluralizes singular words accoring to some heuristics that (hopefully)
 *  look like english grammar.
 */
.filter('plural', function () {
  return function (x, fmt) {
    if (!x) return undefined;
    return x + 's';
  };
}) // replace underscores or dashes for spaces
.filter('worded', function () {
  return function (x, fmt) {
    if (!x) return undefined;
    return ('' + x).replace(/[_-]/g, ' ');
  };
}) // capitalize words
.filter('wordCaps', function () {
  return function (x, fmt) {
    if (!x) return undefined;
    return ('' + x).replace(/\b(\w)/g, function (_1) {
      return _1.toUpperCase();
    });
  };
})
/**
 * @ngdoc factory
 * @name a2.utils.factory:$debounce
 * @description asynchronous debouncing function decorator
 * Decorates an asynchronous function with a debouncing function. A debouncing
 * function withholds the function call by a set ammount of time and wait for
 * any othe function calls, resetting the wait for time every call. After its wait
 * time, the function gets called with the last given arguments and context.
 * @param {Function} fn - the function to debounce
 * @param {Function} rate - the timeout
 * @return {Promise} resolved with the function's return value.
 */
.factory('$debounce', ["$timeout", "$q", "$log", function ($timeout, $q, $log) {
  return function $debounce(fn, rate) {
    var timeoutPromise, qDefer, debouncePromise;
    rate = rate || 100;
    return function () {
      var self = this;
      var args = Array.prototype.slice.call(arguments);

      if (timeoutPromise) {
        $timeout.cancel(timeoutPromise);
      }

      if (!qDefer) {
        qDefer = $q.defer();
        debouncePromise = qDefer.promise.then(function () {
          // qDefer got resolved. forget it's reference in case of recursivity.
          qDefer = null;
          return fn.apply(self, args);
        });
      }

      timeoutPromise = $timeout(function () {
        qDefer.resolve();
      }, rate);
      return debouncePromise;
    };
  };
}]).factory('a2LookaheadHelper', ["$q", function ($q) {
  var a2LookaheadHelper = function (options) {
    this.options = options || {};

    if (!options.searchCompare) {
      options.searchCompare = function (a, b) {
        return a == b;
      };
    }
  };

  a2LookaheadHelper.prototype = {
    search: function (text) {
      var options = this.options;

      if (options.minLength && text.length < options.minLength) {
        return $q.resolve([]);
      }

      var promise = options.fn(text);

      if (options.includeSearch) {
        promise = promise.then(function (items) {
          var textItem = items.filter(function (item) {
            return options.searchCompare(text, item);
          }).pop();

          if (!textItem) {
            items.unshift(options.searchPromote ? options.searchPromote(text) : text);
          }

          return items;
        });
      }

      return promise;
    }
  };
  return a2LookaheadHelper;
}]).service('EventlistManager', function () {
  var EventlistManager = function () {
    this.events = {};
  };

  EventlistManager.prototype.get_event_def = function (event) {
    if (!this.events[event]) {
      this.events[event] = {};
    }

    return this.events[event];
  };

  EventlistManager.prototype.send = function ()
  /* ...args */
  {
    var args = Array.prototype.slice.call(arguments);
    var event = args.shift();

    if (typeof event == 'string') {
      event = {
        event: event
      };
    }

    var eventdef = this.get_event_def(event.event);

    if (event.oneTime) {
      eventdef.oneTime = true;
    }

    var context = event.context;
    var listeners = eventdef.listeners;
    eventdef.fired = true;

    if (listeners) {
      listeners.forEach(function (l) {
        l.apply(context, args);
      });
    }
  };

  EventlistManager.prototype.on = function (event, fn) {
    var eventdef = this.get_event_def(event);

    if (eventdef.fired && eventdef.oneTime) {
      fn.apply();
    } else {
      if (!eventdef.listeners) {
        eventdef.listeners = [];
      }

      eventdef.listeners.push(fn);
    }
  };

  return EventlistManager;
}); // TODO break to multiple files

angular.module('a2.infotags', ['a2.services']).directive('a2Species', ["Species", "$timeout", function (Species, $timeout) {
  return {
    restrict: 'E',
    scope: {
      species: '='
    },
    template: '{{data.scientific_name}}',
    link: function ($scope, $element, $attrs) {
      $scope.$watch('species', function (newVal, oldVal) {
        $scope.data = null;

        if (newVal) {
          Species.findById(newVal, function (data) {
            $timeout(function () {
              $scope.data = data;
            });
          });
        }
      });
    }
  };
}]).directive('a2.songtype', ["Songtypes", "$timeout", function (Songtypes, $timeout) {
  return {
    restrict: 'E',
    scope: {
      songtype: '='
    },
    template: '{{data.name}}',
    link: function ($scope, $element, $attrs) {
      $scope.$watch('songtype', function (newVal, oldVal) {
        $scope.data = null;

        if (newVal) {
          Songtypes.findById(newVal, function (data) {
            $timeout(function () {
              $scope.data = data;
            });
          });
        }
      });
    }
  };
}]); // TODO break to multiple files

angular.module('a2.classy', []).factory('makeClass', ["$inheritFrom", function ($inheritFrom) {
  var slice = Array.prototype.slice;
  return function makeClass(classdef) {
    if (!classdef.constructor) {
      classdef.constructor = classdef.super && classdef.super.constructor ? function super_constructor() {
        this.super.constructor.apply(this, slice.call(arguments));
      } : function empty_constructor() {};
    }

    if (classdef.static) {
      angular.extend(classdef.constructor, classdef.static);
      delete classdef.static;
    }

    if (classdef.super) {
      classdef = $inheritFrom(classdef.super, classdef);
    }

    classdef.constructor.prototype = classdef;
    (window.qc || (window.qc = [])).push(classdef);
    return classdef.constructor;
  };
}]).value('$inheritFrom', function $inheritFrom(object) {
  var fn = function () {};

  fn.prototype = object;

  if (arguments.length > 1) {
    var args = Array.prototype.slice.call(arguments);
    args[0] = new fn();
    return angular.extend.apply(angular, args);
  } else {
    return new fn();
  }
});
angular.module("a2.srv.app-listings", ['a2.srv.api']).service("AppListingsService", ["a2APIService", function (a2APIService) {
  return {
    getFor: function (app) {
      return a2APIService.api.get('/app-listings/' + app);
    }
  };
}]);
angular.module('a2.service.colorscale-gradients', []).service('ColorscaleGradients', function () {
  var g = [];

  for (var i = 0; i < 256; ++i) {
    var j = 255 - i;
    g.push('rgb(' + j + ',' + j + ',' + j + ')');
  }

  var ColorscaleGradients = {
    gradients: [['#4400e5', '#4000e5', '#3c00e5', '#3700e5', '#3300e5', '#2f00e5', '#2a00e5', '#2600e5', '#2200e5', '#1d00e5', '#1900e5', '#1500e5', '#1100e5', '#0c00e5', '#0800e5', '#0400e5', '#0000e5', '#0004e5', '#0008e5', '#000de5', '#0011e5', '#0015e5', '#001ae5', '#001ee5', '#0022e5', '#0027e5', '#002be5', '#002fe5', '#0034e5', '#0038e5', '#003ce5', '#0041e5', '#0045e5', '#0049e5', '#004ee5', '#0052e5', '#0056e5', '#005ae5', '#005fe5', '#0063e5', '#0067e5', '#006ce5', '#0070e5', '#0074e5', '#0079e5', '#007de5', '#0081e5', '#0086e5', '#008ae5', '#008ee5', '#0093e5', '#0097e5', '#009be5', '#00a0e5', '#00a4e5', '#00a8e5', '#00ade5', '#00b1e5', '#00b5e5', '#00bae5', '#00bee5', '#00c2e5', '#00c6e5', '#00cbe5', '#00e543', '#00e53f', '#00e53b', '#00e536', '#00e532', '#00e52e', '#00e529', '#00e525', '#00e521', '#00e51c', '#00e518', '#00e514', '#00e50f', '#00e50b', '#00e507', '#00e502', '#01e500', '#05e500', '#09e500', '#0ee500', '#12e500', '#16e500', '#1be500', '#1fe500', '#23e500', '#28e500', '#2ce500', '#30e500', '#35e500', '#39e500', '#3de500', '#42e500', '#46e500', '#4ae500', '#4fe500', '#53e500', '#57e500', '#5ce500', '#60e500', '#64e500', '#69e500', '#6de500', '#71e500', '#75e500', '#7ae500', '#7ee500', '#82e500', '#87e500', '#8be500', '#8fe500', '#94e500', '#98e500', '#9ce500', '#a1e500', '#a5e500', '#a9e500', '#aee500', '#b2e500', '#b6e500', '#bbe500', '#bfe500', '#c3e500', '#c8e500', '#cce500', '#e5e401', '#e5e303', '#e5e106', '#e5e008', '#e5df0b', '#e5de0d', '#e5dc10', '#e5db12', '#e5da15', '#e5d917', '#e5d81a', '#e5d71c', '#e5d51f', '#e5d422', '#e5d324', '#e5d227', '#e5d229', '#e5d12c', '#e5d02e', '#e5cf31', '#e5ce33', '#e5cd36', '#e5cd38', '#e5cc3b', '#e5cb3d', '#e5cb40', '#e5ca42', '#e5c945', '#e5c947', '#e5c84a', '#e5c84c', '#e5c74f', '#e5c751', '#e5c754', '#e5c656', '#e5c659', '#e5c65b', '#e5c55e', '#e5c561', '#e5c563', '#e5c566', '#e5c468', '#e5c46b', '#e5c46d', '#e5c470', '#e5c472', '#e5c475', '#e5c477', '#e5c47a', '#e5c47c', '#e5c57f', '#e5c581', '#e5c584', '#e5c586', '#e5c589', '#e5c68b', '#e5c68e', '#e5c690', '#e5c793', '#e5c795', '#e5c898', '#e5c89a', '#e5c99d', '#e5c9a0', '#916225', '#926328', '#93652a', '#95672c', '#96682f', '#986a31', '#996c33', '#9a6d36', '#9c6f38', '#9d713a', '#9f723d', '#a0743f', '#a27641', '#a37744', '#a47946', '#a67a48', '#a77c4b', '#a97e4d', '#aa7f4f', '#ab8152', '#ad8354', '#ae8456', '#b08659', '#b1885b', '#b2895d', '#b48b60', '#b58d62', '#b78e64', '#b89067', '#ba9269', '#bb936b', '#bc956e', '#be9670', '#bf9872', '#c19a75', '#c29b77', '#c39d79', '#c59f7c', '#c6a07e', '#c8a280', '#c9a483', '#caa585', '#cca787', '#cda98a', '#cfaa8c', '#d0ac8e', '#d2ad91', '#d3af93', '#d4b195', '#d6b298', '#d7b49a', '#d9b69c', '#dab79f', '#dbb9a1', '#ddbba3', '#debca6', '#e0bea8', '#e1c0aa', '#e2c1ad', '#e4c3af', '#e5c5b1', '#e7c6b4', '#e8c8b6', '#eacab9'], ['#ffffff', '#fefefe', '#fdfdfd', '#fcfcfc', '#fbfbfb', '#fafafa', '#f9f9f9', '#f8f8f8', '#f7f7f7', '#f6f6f6', '#f5f5f5', '#f4f4f4', '#f3f3f3', '#f2f2f2', '#f1f1f1', '#f0f0f0', '#efefef', '#eeeeee', '#ededed', '#ececec', '#ebebeb', '#eaeaea', '#e9e9e9', '#e8e8e8', '#e7e7e7', '#e6e6e6', '#e5e5e5', '#e4e4e4', '#e3e3e3', '#e2e2e2', '#e1e1e1', '#e0e0e0', '#dfdfdf', '#dedede', '#dddddd', '#dcdcdc', '#dbdbdb', '#dadada', '#d9d9d9', '#d8d8d8', '#d7d7d7', '#d6d6d6', '#d5d5d5', '#d4d4d4', '#d3d3d3', '#d2d2d2', '#d1d1d1', '#d0d0d0', '#cfcfcf', '#cecece', '#cdcdcd', '#cccccc', '#cbcbcb', '#cacaca', '#c9c9c9', '#c8c8c8', '#c7c7c7', '#c6c6c6', '#c5c5c5', '#c4c4c4', '#c3c3c3', '#c2c2c2', '#c1c1c1', '#c0c0c0', '#bfbfbf', '#bebebe', '#bdbdbd', '#bcbcbc', '#bbbbbb', '#bababa', '#b9b9b9', '#b8b8b8', '#b7b7b7', '#b6b6b6', '#b5b5b5', '#b4b4b4', '#b3b3b3', '#b2b2b2', '#b1b1b1', '#b0b0b0', '#afafaf', '#aeaeae', '#adadad', '#acacac', '#ababab', '#aaaaaa', '#a9a9a9', '#a8a8a8', '#a7a7a7', '#a6a6a6', '#a5a5a5', '#a4a4a4', '#a3a3a3', '#a2a2a2', '#a1a1a1', '#a0a0a0', '#9f9f9f', '#9e9e9e', '#9d9d9d', '#9c9c9c', '#9b9b9b', '#9a9a9a', '#999999', '#989898', '#979797', '#969696', '#959595', '#949494', '#939393', '#929292', '#919191', '#909090', '#8f8f8f', '#8e8e8e', '#8d8d8d', '#8c8c8c', '#8b8b8b', '#8a8a8a', '#898989', '#888888', '#878787', '#868686', '#858585', '#848484', '#838383', '#828282', '#818181', '#808080', '#7f7f7f', '#7e7e7e', '#7d7d7d', '#7c7c7c', '#7b7b7b', '#7a7a7a', '#797979', '#787878', '#777777', '#767676', '#757575', '#747474', '#737373', '#727272', '#717171', '#707070', '#6f6f6f', '#6e6e6e', '#6d6d6d', '#6c6c6c', '#6b6b6b', '#6a6a6a', '#696969', '#686868', '#676767', '#666666', '#656565', '#646464', '#636363', '#626262', '#616161', '#606060', '#5f5f5f', '#5e5e5e', '#5d5d5d', '#5c5c5c', '#5b5b5b', '#5a5a5a', '#595959', '#585858', '#575757', '#565656', '#555555', '#545454', '#535353', '#525252', '#515151', '#505050', '#4f4f4f', '#4e4e4e', '#4d4d4d', '#4c4c4c', '#4b4b4b', '#4a4a4a', '#494949', '#484848', '#474747', '#464646', '#454545', '#444444', '#434343', '#424242', '#414141', '#404040', '#3f3f3f', '#3e3e3e', '#3d3d3d', '#3c3c3c', '#3b3b3b', '#3a3a3a', '#393939', '#383838', '#373737', '#363636', '#353535', '#343434', '#333333', '#323232', '#313131', '#303030', '#2f2f2f', '#2e2e2e', '#2d2d2d', '#2c2c2c', '#2b2b2b', '#2a2a2a', '#292929', '#282828', '#272727', '#262626', '#252525', '#242424', '#232323', '#222222', '#212121', '#202020', '#1f1f1f', '#1e1e1e', '#1d1d1d', '#1c1c1c', '#1b1b1b', '#1a1a1a', '#191919', '#181818', '#171717', '#161616', '#151515', '#141414', '#131313', '#121212', '#111111', '#101010', '#0f0f0f', '#0e0e0e', '#0d0d0d', '#0c0c0c', '#0b0b0b', '#0a0a0a', '#090909', '#080808', '#070707', '#060606', '#050505', '#040404', '#030303', '#020202', '#010101', '#000000'], ['#0a0000', '#0d0000', '#0f0000', '#120000', '#150000', '#170000', '#1a0000', '#1c0000', '#1f0000', '#220000', '#240000', '#270000', '#2a0000', '#2c0000', '#2f0000', '#310000', '#340000', '#370000', '#390000', '#3c0000', '#3f0000', '#410000', '#440000', '#460000', '#490000', '#4c0000', '#4e0000', '#510000', '#540000', '#560000', '#590000', '#5b0000', '#5e0000', '#610000', '#630000', '#660000', '#690000', '#6b0000', '#6e0000', '#700000', '#730000', '#760000', '#780000', '#7b0000', '#7e0000', '#800000', '#830000', '#850000', '#880000', '#8b0000', '#8d0000', '#900000', '#930000', '#950000', '#980000', '#9a0000', '#9d0000', '#a00000', '#a20000', '#a50000', '#a80000', '#aa0000', '#ad0000', '#af0000', '#b20000', '#b50000', '#b70000', '#ba0000', '#bd0000', '#bf0000', '#c20000', '#c40000', '#c70000', '#ca0000', '#cc0000', '#cf0000', '#d20000', '#d40000', '#d70000', '#d90000', '#dc0000', '#df0000', '#e10000', '#e40000', '#e70000', '#e90000', '#ec0000', '#ee0000', '#f10000', '#f40000', '#f60000', '#f90000', '#fc0000', '#fe0000', '#ff0200', '#ff0500', '#ff0700', '#ff0a00', '#ff0c00', '#ff0f00', '#ff1200', '#ff1400', '#ff1700', '#ff1a00', '#ff1c00', '#ff1f00', '#ff2100', '#ff2400', '#ff2700', '#ff2900', '#ff2c00', '#ff2f00', '#ff3100', '#ff3400', '#ff3600', '#ff3900', '#ff3c00', '#ff3e00', '#ff4100', '#ff4400', '#ff4600', '#ff4900', '#ff4b00', '#ff4e00', '#ff5100', '#ff5300', '#ff5600', '#ff5900', '#ff5b00', '#ff5e00', '#ff6000', '#ff6300', '#ff6600', '#ff6800', '#ff6b00', '#ff6e00', '#ff7000', '#ff7300', '#ff7500', '#ff7800', '#ff7b00', '#ff7d00', '#ff8000', '#ff8300', '#ff8500', '#ff8800', '#ff8a00', '#ff8d00', '#ff9000', '#ff9200', '#ff9500', '#ff9700', '#ff9a00', '#ff9d00', '#ff9f00', '#ffa200', '#ffa500', '#ffa700', '#ffaa00', '#ffac00', '#ffaf00', '#ffb200', '#ffb400', '#ffb700', '#ffba00', '#ffbc00', '#ffbf00', '#ffc100', '#ffc400', '#ffc700', '#ffc900', '#ffcc00', '#ffcf00', '#ffd100', '#ffd400', '#ffd600', '#ffd900', '#ffdc00', '#ffde00', '#ffe100', '#ffe400', '#ffe600', '#ffe900', '#ffeb00', '#ffee00', '#fff100', '#fff300', '#fff600', '#fff900', '#fffb00', '#fffe00', '#ffff02', '#ffff06', '#ffff0a', '#ffff0e', '#ffff12', '#ffff16', '#ffff1a', '#ffff1e', '#ffff22', '#ffff26', '#ffff2a', '#ffff2e', '#ffff32', '#ffff36', '#ffff3a', '#ffff3e', '#ffff41', '#ffff45', '#ffff49', '#ffff4d', '#ffff51', '#ffff55', '#ffff59', '#ffff5d', '#ffff61', '#ffff65', '#ffff69', '#ffff6d', '#ffff71', '#ffff75', '#ffff79', '#ffff7d', '#ffff80', '#ffff84', '#ffff88', '#ffff8c', '#ffff90', '#ffff94', '#ffff98', '#ffff9c', '#ffffa0', '#ffffa4', '#ffffa8', '#ffffac', '#ffffb0', '#ffffb4', '#ffffb8', '#ffffbc', '#ffffbf', '#ffffc3', '#ffffc7', '#ffffcb', '#ffffcf', '#ffffd3', '#ffffd7', '#ffffdb', '#ffffdf', '#ffffe3', '#ffffe7', '#ffffeb', '#ffffef', '#fffff3', '#fffff7', '#fffffb', '#ffffff'], ['#000000', '#120102', '#240204', '#360306', '#490408', '#5b050a', '#6d060c', '#7f070e', '#920810', '#a40912', '#b60a14', '#c90b16', '#db0c18', '#ed0d1a', '#fe0e1c', '#f90f1e', '#f41020', '#ef1122', '#ea1224', '#e51326', '#e01428', '#db152a', '#d6162c', '#d1172e', '#cc1830', '#c71932', '#c21a34', '#bd1b36', '#b81c38', '#b41d3a', '#af1e3c', '#aa1f3e', '#a52040', '#a02041', '#9b2244', '#962346', '#912448', '#8c2449', '#87264c', '#82274e', '#7d2850', '#782851', '#732a54', '#6e2b56', '#692c58', '#642c59', '#5f2e5c', '#5a2f5e', '#553060', '#503061', '#4b3264', '#463366', '#413468', '#3c3469', '#37366c', '#32376e', '#2d3870', '#283871', '#233a74', '#1e3b76', '#193c78', '#143c79', '#0f3e7c', '#0a3f7e', '#404080', '#414182', '#414183', '#434386', '#444488', '#45458a', '#46468c', '#47478e', '#484890', '#494992', '#494993', '#4b4b96', '#4c4c98', '#4d4d9a', '#4e4e9c', '#4f4f9e', '#5050a0', '#5151a2', '#5151a3', '#5353a6', '#5454a8', '#5555aa', '#5656ac', '#5757ae', '#5858b0', '#5959b2', '#5959b3', '#5b5bb6', '#5c5cb8', '#5d5dba', '#5e5ebc', '#5f5fbe', '#6060c0', '#6161c2', '#6161c3', '#6363c6', '#6464c8', '#6565ca', '#6666cc', '#6767ce', '#6868d0', '#6969d2', '#6969d3', '#6b6bd6', '#6c6cd8', '#6d6dda', '#6e6edc', '#6f6fde', '#7070e0', '#7171e2', '#7171e3', '#7373e6', '#7474e8', '#7575ea', '#7676ec', '#7777ee', '#7878f0', '#7979f2', '#7979f3', '#7b7bf6', '#7c7cf8', '#7d7dfa', '#7e7efc', '#7f7ffe', '#8080fc', '#8181f8', '#8282f4', '#8383f0', '#8383eb', '#8485e7', '#8686e3', '#8787df', '#8888da', '#8989d6', '#8a8ad2', '#8b8bce', '#8c8cc9', '#8d8dc5', '#8e8ec1', '#8f8fbd', '#9090b8', '#9191b4', '#9292b0', '#9393ac', '#9393a7', '#9595a3', '#96969f', '#97979a', '#989896', '#999992', '#9a9a8e', '#9b9b89', '#9c9c85', '#9d9d81', '#9e9e7d', '#9f9f78', '#a0a074', '#a1a170', '#a2a26c', '#a3a367', '#a3a363', '#a5a55f', '#a6a65b', '#a7a756', '#a8a852', '#a9a94e', '#aaaa4a', '#abab45', '#acac41', '#adad3d', '#aeae39', '#afaf34', '#b0b030', '#b1b12c', '#b2b228', '#b3b323', '#b3b31f', '#b5b51b', '#b6b617', '#b7b712', '#b8b80e', '#b9b90a', '#baba06', '#bbbb01', '#bcbc02', '#bdbd05', '#bebe09', '#bfbf0d', '#c0c011', '#c1c115', '#c2c218', '#c3c31c', '#c3c320', '#c4c524', '#c5c627', '#c7c72b', '#c8c82f', '#c9c933', '#caca37', '#cbcb3a', '#cbcc3e', '#cdcd42', '#cece46', '#cfcf49', '#d0d04d', '#d1d151', '#d2d255', '#d3d358', '#d3d35c', '#d5d560', '#d6d664', '#d7d768', '#d8d86b', '#d9d96f', '#dada73', '#dbdb77', '#dcdc7a', '#dddd7e', '#dede82', '#dfdf86', '#e0e08a', '#e1e18d', '#e2e291', '#e3e395', '#e3e399', '#e5e59c', '#e6e6a0', '#e7e7a4', '#e8e8a8', '#e9e9ab', '#eaeaaf', '#ebebb3', '#ececb7', '#ededbb', '#eeeebe', '#efefc2', '#f0f0c6', '#f1f1ca', '#f2f2cd', '#f3f3d1', '#f3f3d5', '#f4f5d9', '#f5f6dd', '#f7f7e0', '#f8f8e4', '#f9f9e8', '#fafaec', '#fbfbef', '#fbfcf3', '#fdfdf7', '#fefefb', '#ffffff'], ['#000080', '#000776', '#000e6d', '#001563', '#001d5a', '#002450', '#002b47', '#00333e', '#003a34', '#00412b', '#004821', '#005018', '#00570f', '#005e05', '#005816', '#005126', '#004a37', '#004348', '#003d58', '#003669', '#002f79', '#00288a', '#00219b', '#001bab', '#0014bc', '#000dcd', '#0006dd', '#0000ee', '#000eff', '#001cff', '#002aff', '#0038ff', '#0046ff', '#0054ff', '#0062ff', '#0070ff', '#007fff', '#008dff', '#009bff', '#00a9ff', '#00b7ff', '#00c0ff', '#00c5ff', '#00caff', '#00ceff', '#00d2ff', '#00d7ff', '#00dbff', '#00e0ff', '#00e4ff', '#00e8ff', '#00edff', '#00f1fe', '#00f6f8', '#00faf1', '#00feeb', '#00fee4', '#00fede', '#00fdd7', '#00fdd1', '#00fcca', '#00fcc3', '#00fbbd', '#00fbb6', '#00fab0', '#00faa9', '#00faa3', '#00fa9c', '#00fa92', '#00fa87', '#00fa7d', '#00fa72', '#00fb68', '#00fb5d', '#00fc53', '#00fc49', '#00fc3e', '#00fd34', '#00fd29', '#00fe1f', '#06fe14', '#0cfe0a', '#13fb00', '#19f700', '#1ff300', '#26ef00', '#2cec00', '#32e800', '#39e400', '#3fe000', '#46dd00', '#4cd900', '#52d500', '#59d100', '#5fce00', '#65d100', '#67d400', '#69d700', '#6bdb00', '#6dde00', '#6fe100', '#71e400', '#73e800', '#75eb00', '#77ee00', '#79f100', '#7bf500', '#7df803', '#7ffb07', '#84fe0b', '#88ff0f', '#8dff13', '#91ff17', '#96ff1b', '#9aff1f', '#9fff23', '#a4ff27', '#a8ff2b', '#adff2f', '#b1ff33', '#b6ff37', '#baff3b', '#bfff37', '#c3ff33', '#c8ff2f', '#ccff2b', '#d1ff27', '#d6ff23', '#daff1f', '#dfff1b', '#e3ff17', '#e8ff13', '#ecff0f', '#f1ff0b', '#f5fc07', '#fafa03', '#fff700', '#fff500', '#fff200', '#fff000', '#ffed00', '#ffeb00', '#ffe800', '#ffe600', '#ffe300', '#ffe100', '#ffde00', '#ffdc00', '#ffda00', '#ffd701', '#ffd502', '#ffd203', '#ffd004', '#ffcd05', '#ffcb06', '#ffc807', '#ffc608', '#ffc309', '#ffc10a', '#ffbe0b', '#ffbc0c', '#ffb90d', '#ffb10d', '#ffa90c', '#ffa10b', '#ff990a', '#ff9109', '#ff8808', '#ff8007', '#ff7806', '#ff7005', '#ff6804', '#ff5f03', '#ff5702', '#ff4f01', '#ff4700', '#ff4200', '#ff3d00', '#ff3900', '#ff3400', '#ff2f00', '#ff2a00', '#ff2600', '#ff2100', '#ff1c00', '#ff1700', '#ff1300', '#ff0e00', '#ff0900', '#ff0411', '#ff0023', '#ff0035', '#ff0046', '#ff0058', '#ff006a', '#ff007b', '#ff008d', '#ff009f', '#ff00b1', '#ff00c2', '#ff00d4', '#ff00e6', '#ff00f8', '#f803fb', '#f106ff', '#ea0aff', '#e30dff', '#dc11ff', '#d514ff', '#ce18ff', '#c71bff', '#c11eff', '#ba22ff', '#b325ff', '#ac29ff', '#a52cfe', '#9e32fd', '#a438fc', '#aa3efb', '#b044fa', '#b64af8', '#bc50f7', '#c256f6', '#c75cf5', '#cd61f4', '#d367f2', '#d96df1', '#df73f0', '#e579ef', '#eb7fee', '#ec84ee', '#ec88ef', '#ed8df0', '#ee92f0', '#ef96f1', '#ef9bf1', '#f09ff2', '#f1a4f3', '#f1a9f3', '#f2adf4', '#f3b2f4', '#f4b7f5', '#f4bbf6', '#f5c0f6', '#f6c5f7', '#f6c9f7', '#f7cef8', '#f8d2f9', '#f9d7f9', '#f9dcfa', '#fae0fa', '#fbe5fb', '#fbeafc', '#fceefc', '#fdf3fd', '#fef7fe'] // ['#ffffff', '#fefefe', '#fdfdfd', '#fcfcfc', '#fbfbfb', '#fafafa', '#f9f9f9', '#f8f8f8', '#f7f7f7', '#f6f6f6', '#f5f5f5', '#f4f4f4', '#f3f3f3', '#f2f2f2', '#f1f1f1', '#f0f0f0', '#efefef', '#eeeeee', '#ededed', '#ececec', '#ebebeb', '#eaeaea', '#e9e9e9', '#e8e8e8', '#e7e7e7', '#e6e6e6', '#e5e5e5', '#e4e4e4', '#e3e3e3', '#e2e2e2', '#e1e1e1', '#e0e0e0', '#dfdfdf', '#dedede', '#dddddd', '#dcdcdc', '#dbdbdb', '#dadada', '#d9d9d9', '#d8d8d8', '#d7d7d7', '#d6d6d6', '#d5d5d5', '#d3d3d3', '#d3d3d3', '#d2d2d2', '#d1d1d1', '#d0d0d0', '#cfcfcf', '#cecece', '#cdcdcd', '#cccccc', '#cbcbcb', '#cacaca', '#c9c9c9', '#c8c8c8', '#c7c7c7', '#c6c6c6', '#c5c5c5', '#c3c3c3', '#c3c3c3', '#c2c2c2', '#c1c1c1', '#c0c0c0', '#bfbfbf', '#bebebe', '#bdbdbd', '#bcbcbc', '#bbbbbb', '#bababa', '#b9b9b9', '#b8b8b8', '#b7b7b7', '#b6b6b6', '#b5b5b5', '#b3b3b3', '#b3b3b3', '#b2b2b2', '#b1b1b1', '#b0b0b0', '#afafaf', '#aeaeae', '#adadad', '#acacac', '#ababab', '#aaaaaa', '#a9a9a9', '#a8a8a8', '#a7a7a7', '#a6a6a6', '#a5a5a5', '#a3a3a3', '#a3a3a3', '#a2a2a2', '#a1a1a1', '#a0a0a0', '#9f9f9f', '#9e9e9e', '#9d9d9d', '#9c9c9c', '#9b9b9b', '#9a9a9a', '#999999', '#989898', '#979797', '#969696', '#959595', '#939393', '#939393', '#929292', '#919191', '#909090', '#8f8f8f', '#8e8e8e', '#8d8d8d', '#8c8c8c', '#8b8b8b', '#8a8a8a', '#898989', '#888888', '#878787', '#868686', '#858585', '#838383', '#838383', '#828282', '#818181', '#808080', '#7f7f7f', '#7e7e7e', '#7d7d7d', '#7c7c7c', '#7b7b7b', '#797979', '#797979', '#787878', '#777777', '#767676', '#757575', '#747474', '#727272', '#717171', '#717171', '#707070', '#6f6f6f', '#6e6e6e', '#6d6d6d', '#6c6c6c', '#6b6b6b', '#696969', '#696969', '#686868', '#676767', '#666666', '#656565', '#646464', '#626262', '#616161', '#616161', '#606060', '#5f5f5f', '#5e5e5e', '#5d5d5d', '#5c5c5c', '#5b5b5b', '#595959', '#595959', '#585858', '#575757', '#565656', '#555555', '#545454', '#525252', '#515151', '#515151', '#505050', '#4f4f4f', '#4e4e4e', '#4d4d4d', '#4c4c4c', '#4b4b4b', '#494949', '#494949', '#484848', '#474747', '#464646', '#454545', '#444444', '#424242', '#414141', '#414141', '#404040', '#3f3f3f', '#3e3e3e', '#3d3d3d', '#3c3c3c', '#3b3b3b', '#393939', '#383838', '#383838', '#373737', '#363636', '#353535', '#343434', '#323232', '#313131', '#303030', '#303030', '#2f2f2f', '#2e2e2e', '#2d2d2d', '#2c2c2c', '#2b2b2b', '#292929', '#282828', '#282828', '#272727', '#262626', '#252525', '#242424', '#222222', '#212121', '#202020', '#202020', '#1f1f1f', '#1e1e1e', '#1d1d1d', '#1c1c1c', '#1b1b1b', '#191919', '#181818', '#181818', '#171717', '#161616', '#151515', '#141414', '#121212', '#111111', '#101010', '#101010', '#0f0f0f', '#0e0e0e', '#0d0d0d', '#0c0c0c', '#0b0b0b', '#090909', '#080808', '#080808', '#070707', '#060606', '#050505', '#040404', '#020202', '#010101', '#000000', '#000000'],
    // ['#000000', '#010000', '#030000', '#040000', '#060000', '#070000', '#090000', '#0a0000', '#0c0000', '#0d0000', '#0f0000', '#100000', '#120000', '#130000', '#150000', '#160000', '#180000', '#190000', '#1b0000', '#1c0000', '#1e0000', '#1f0000', '#200000', '#220000', '#240000', '#250000', '#270000', '#280000', '#2a0000', '#2b0000', '#2c0000', '#2e0000', '#300000', '#310000', '#330000', '#340000', '#360000', '#370000', '#380000', '#3a0000', '#3c0000', '#3d0000', '#3f0000', '#400000', '#410000', '#430000', '#450000', '#460000', '#480000', '#490000', '#4b0000', '#4c0000', '#4e0000', '#4f0000', '#510000', '#520000', '#540000', '#550000', '#570000', '#580000', '#590000', '#5b0000', '#5d0000', '#5e0000', '#600000', '#610000', '#620000', '#640000', '#660000', '#670000', '#690000', '#6a0000', '#6c0000', '#6d0000', '#6e0000', '#700000', '#710000', '#730000', '#750000', '#760000', '#780000', '#790000', '#7a0000', '#7c0000', '#7e0000', '#7f0000', '#810000', '#820000', '#830000', '#850000', '#860000', '#880000', '#8a0000', '#8b0000', '#8d0000', '#8e0000', '#900000', '#910000', '#930000', '#940000', '#960000', '#970000', '#990000', '#9a0000', '#9c0000', '#9d0000', '#9f0000', '#a00000', '#a20000', '#a30000', '#a50000', '#a60000', '#a80000', '#a90000', '#ab0000', '#ac0000', '#ae0000', '#af0000', '#b10000', '#b20000', '#b30000', '#b50000', '#b60000', '#b80000', '#ba0000', '#bb0000', '#bd0000', '#be0000', '#c00000', '#c10200', '#c30400', '#c40600', '#c50800', '#c70b00', '#c90d00', '#ca0f00', '#cc1000', '#cd1200', '#cf1400', '#d01600', '#d21900', '#d31b00', '#d51d00', '#d61f00', '#d82000', '#d92200', '#db2400', '#dc2600', '#dd2800', '#df2b00', '#e12d00', '#e22f00', '#e33000', '#e53200', '#e63400', '#e83600', '#ea3900', '#eb3b00', '#ed3d00', '#ee3f00', '#f04100', '#f14200', '#f34400', '#f44600', '#f54800', '#f74b00', '#f94d00', '#fa4f00', '#fc5100', '#fd5200', '#ff5400', '#ff5600', '#ff5900', '#ff5b00', '#ff5d00', '#ff5f00', '#ff6100', '#ff6200', '#ff6400', '#ff6600', '#ff6800', '#ff6b00', '#ff6d00', '#ff6f00', '#ff7100', '#ff7200', '#ff7400', '#ff7600', '#ff7900', '#ff7b00', '#ff7d00', '#ff7f00', '#ff8102', '#ff8306', '#ff840a', '#ff860e', '#ff8812', '#ff8b17', '#ff8d1b', '#ff8f1f', '#ff9122', '#ff9326', '#ff942a', '#ff962e', '#ff9933', '#ff9b37', '#ff9d3b', '#ff9f3f', '#ffa142', '#ffa346', '#ffa44a', '#ffa64e', '#ffa852', '#ffab57', '#ffad5b', '#ffaf5f', '#ffb162', '#ffb366', '#ffb46a', '#ffb66e', '#ffb973', '#ffbb77', '#ffbd7b', '#ffbf7f', '#ffc183', '#ffc386', '#ffc48a', '#ffc68e', '#ffc892', '#ffcb97', '#ffcd9b', '#ffcf9f', '#ffd1a3', '#ffd3a6', '#ffd4aa', '#ffd6ae', '#ffd9b3', '#ffdbb7', '#ffddbb', '#ffdfbf', '#ffe1c3', '#ffe3c6', '#ffe4ca', '#ffe6ce', '#ffe8d2', '#ffebd7', '#ffeddb', '#ffefdf', '#fff1e3', '#fff3e6', '#fff4ea', '#fff6ee', '#fff9f3', '#fffbf7', '#fffdfb', '#ffffff'],
    // ['#00007f', '#000084', '#000088', '#00008d', '#000091', '#000096', '#00009a', '#00009f', '#0000a3', '#0000a8', '#0000ac', '#0000b1', '#0000b6', '#0000ba', '#0000bf', '#0000c3', '#0000c8', '#0000cc', '#0000d1', '#0000d5', '#0000da', '#0000de', '#0000e3', '#0000e8', '#0000ec', '#0000f1', '#0000f5', '#0000fa', '#0000fe', '#0000ff', '#0000ff', '#0000ff', '#0000ff', '#0004ff', '#0008ff', '#000cff', '#0010ff', '#0014ff', '#0018ff', '#001cff', '#0020ff', '#0024ff', '#0028ff', '#002cff', '#0030ff', '#0034ff', '#0038ff', '#003cff', '#0040ff', '#0044ff', '#0048ff', '#004cff', '#0050ff', '#0054ff', '#0058ff', '#005cff', '#0060ff', '#0064ff', '#0068ff', '#006cff', '#0070ff', '#0074ff', '#0078ff', '#007cff', '#0080ff', '#0084ff', '#0088ff', '#008cff', '#0090ff', '#0094ff', '#0098ff', '#009cff', '#00a0ff', '#00a4ff', '#00a8ff', '#00acff', '#00b0ff', '#00b4ff', '#00b8ff', '#00bcff', '#00c0ff', '#00c4ff', '#00c8ff', '#00ccff', '#00d0ff', '#00d4ff', '#00d8ff', '#00dcfe', '#00e0fa', '#00e4f7', '#02e8f4', '#05ecf1', '#08f0ed', '#0cf4ea', '#0ff8e7', '#12fce4', '#15ffe1', '#18ffdd', '#1cffda', '#1fffd7', '#22ffd4', '#25ffd0', '#29ffcd', '#2cffca', '#2fffc7', '#32ffc3', '#36ffc0', '#39ffbd', '#3cffba', '#3fffb7', '#42ffb3', '#46ffb0', '#49ffad', '#4cffaa', '#4fffa6', '#53ffa3', '#56ffa0', '#59ff9d', '#5cff9a', '#5fff96', '#63ff93', '#66ff90', '#69ff8d', '#6cff89', '#70ff86', '#73ff83', '#76ff80', '#79ff7d', '#7cff79', '#80ff76', '#83ff73', '#86ff70', '#89ff6c', '#8dff69', '#90ff66', '#93ff63', '#96ff5f', '#9aff5c', '#9dff59', '#a0ff56', '#a3ff53', '#a6ff4f', '#aaff4c', '#adff49', '#b0ff46', '#b3ff42', '#b7ff3f', '#baff3c', '#bdff39', '#c0ff36', '#c3ff32', '#c7ff2f', '#caff2c', '#cdff29', '#d0ff25', '#d4ff22', '#d7ff1f', '#daff1c', '#ddff18', '#e0ff15', '#e4ff12', '#e7ff0f', '#eaff0c', '#edff08', '#f1fc05', '#f4f802', '#f7f400', '#faf000', '#feed00', '#ffe900', '#ffe500', '#ffe200', '#ffde00', '#ffda00', '#ffd700', '#ffd300', '#ffcf00', '#ffcb00', '#ffc800', '#ffc400', '#ffc000', '#ffbd00', '#ffb900', '#ffb500', '#ffb100', '#ffae00', '#ffaa00', '#ffa600', '#ffa300', '#ff9f00', '#ff9b00', '#ff9800', '#ff9400', '#ff9000', '#ff8c00', '#ff8900', '#ff8500', '#ff8100', '#ff7e00', '#ff7a00', '#ff7600', '#ff7300', '#ff6f00', '#ff6b00', '#ff6700', '#ff6400', '#ff6000', '#ff5c00', '#ff5900', '#ff5500', '#ff5100', '#ff4d00', '#ff4a00', '#ff4600', '#ff4200', '#ff3f00', '#ff3b00', '#ff3700', '#ff3400', '#ff3000', '#ff2c00', '#ff2800', '#ff2500', '#ff2100', '#ff1d00', '#ff1a00', '#ff1600', '#fe1200', '#fa0f00', '#f50b00', '#f10700', '#ec0300', '#e80000', '#e30000', '#de0000', '#da0000', '#d50000', '#d10000', '#cc0000', '#c80000', '#c30000', '#bf0000', '#ba0000', '#b60000', '#b10000', '#ac0000', '#a80000', '#a30000', '#9f0000', '#9a0000', '#960000', '#910000', '#8d0000', '#880000', '#840000', '#7f0000'],
    // ['#000000', '#00002b', '#010038', '#010043', '#02004e', '#030058', '#030063', '#04006e', '#050273', '#050474', '#060674', '#070974', '#070b74', '#080d74', '#091075', '#091275', '#0a1475', '#0b1675', '#0b1975', '#0c1b75', '#0d1d76', '#0d2076', '#0e2276', '#0f2476', '#0f2776', '#102977', '#112b77', '#112d77', '#123077', '#133277', '#133477', '#143678', '#153878', '#153a78', '#163c78', '#173e78', '#174079', '#184279', '#194579', '#194779', '#1a4979', '#1b4b79', '#1b4d7a', '#1c4f7a', '#1d517a', '#1d537a', '#1e547a', '#1f567b', '#1f587b', '#205a7b', '#215c7b', '#215e7b', '#22607b', '#23617c', '#23637c', '#24657c', '#25667c', '#25687c', '#26697d', '#276b7d', '#276d7d', '#286e7d', '#29707d', '#29717d', '#2a737e', '#2b747e', '#2b767e', '#2c787e', '#2d797e', '#2d7b7f', '#2e7c7f', '#2f7e7f', '#2f7f7f', '#30807e', '#30817d', '#31817b', '#31827a', '#328279', '#328378', '#338477', '#338475', '#348574', '#348573', '#358672', '#358670', '#36876f', '#36886e', '#37886d', '#37896c', '#38896a', '#388a69', '#388a68', '#398b67', '#398c65', '#3a8c64', '#3a8d63', '#3b8d62', '#3b8e61', '#3c8e5f', '#3c8f5e', '#3d905d', '#3d905c', '#3e915a', '#3e9159', '#3f9258', '#3f9357', '#409355', '#409454', '#409453', '#419552', '#419551', '#42964f', '#42974e', '#43974d', '#43984c', '#44984a', '#449949', '#459948', '#479a47', '#499b46', '#4b9b46', '#4e9c47', '#509c47', '#529d48', '#549d48', '#579e49', '#599f4a', '#5b9f4a', '#5da04b', '#5fa04b', '#62a14c', '#64a14d', '#66a24d', '#68a34e', '#6ba34e', '#6da34f', '#6fa44f', '#71a450', '#73a551', '#76a551', '#78a652', '#79a652', '#7ba752', '#7da752', '#7ea753', '#80a853', '#82a853', '#83a954', '#85a954', '#87aa54', '#88aa55', '#8aab55', '#8cab55', '#8dab56', '#8fac56', '#91ac56', '#92ad57', '#94ad57', '#96ae57', '#97ae58', '#99ae58', '#9aaf58', '#9caf58', '#9eb059', '#9fb059', '#a1b159', '#a3b15a', '#a4b25a', '#a6b25a', '#a8b25b', '#a9b35b', '#abb35b', '#adb45c', '#aeb45c', '#b0b55c', '#b2b55d', '#b3b55d', '#b5b65d', '#b6b65e', '#b7b55e', '#b7b55e', '#b8b45f', '#b8b35f', '#b9b25f', '#b9b15f', '#b9b060', '#baaf60', '#baaf60', '#bbae61', '#bbad61', '#bcac61', '#bcab62', '#bcaa62', '#bda962', '#bda963', '#bea863', '#bea763', '#bea664', '#bfa564', '#bfa464', '#c0a365', '#c0a367', '#c1a369', '#c2a36c', '#c3a46e', '#c5a471', '#c6a573', '#c7a676', '#c8a678', '#c9a77b', '#caa87d', '#cba97f', '#ccaa82', '#ceab84', '#cfac87', '#d0ad89', '#d1ad8c', '#d2ae8e', '#d3af91', '#d4b093', '#d5b196', '#d6b298', '#d8b39a', '#d9b59d', '#dab69f', '#dbb7a2', '#dcb9a4', '#ddbaa7', '#debca9', '#dfbdac', '#e1bfaf', '#e2c1b2', '#e3c3b5', '#e4c5b8', '#e5c7bb', '#e6c9be', '#e7cbc1', '#e8cdc4', '#e9cfc7', '#ebd1ca', '#ecd3cd', '#edd5d0', '#eed7d3', '#efd9d6', '#f0dcd9', '#f1dedc', '#f2e0df', '#f4e3e2', '#f5e6e5', '#f6e9e8', '#f7eceb', '#f8efee', '#f9f2f1', '#faf5f4', '#fbf8f7', '#fdfafa'],
    // ['#000000', '#010101', '#020202', '#030303', '#040404', '#050505', '#060606', '#070707', '#080808', '#090909', '#0a0a0a', '#0b0b0b', '#0c0c0c', '#0d0d0d', '#0e0e0e', '#0f0f0f', '#101010', '#111111', '#121212', '#131313', '#141414', '#151515', '#161616', '#171717', '#181818', '#191919', '#1a1a1a', '#1b1b1b', '#1c1c1c', '#1d1d1d', '#1e1e1e', '#1f1f1f', '#202020', '#202020', '#222222', '#232323', '#242424', '#242424', '#262626', '#272727', '#282828', '#282828', '#2a2a2a', '#2b2b2b', '#2c2c2c', '#2c2c2c', '#2e2e2e', '#2f2f2f', '#303030', '#303030', '#323232', '#333333', '#343434', '#343434', '#363636', '#373737', '#383838', '#383838', '#3a3a3a', '#3b3b3b', '#3c3c3c', '#3c3c3c', '#3e3e3e', '#3f3f3f', '#404040', '#414141', '#414141', '#434343', '#444444', '#454545', '#464646', '#474747', '#484848', '#494949', '#494949', '#4b4b4b', '#4c4c4c', '#4d4d4d', '#4e4e4e', '#4f4f4f', '#505050', '#515151', '#515151', '#535353', '#545454', '#555555', '#565656', '#575757', '#585858', '#595959', '#595959', '#5b5b5b', '#5c5c5c', '#5d5d5d', '#5e5e5e', '#5f5f5f', '#606060', '#616161', '#616161', '#636363', '#646464', '#656565', '#666666', '#676767', '#686868', '#696969', '#696969', '#6b6b6b', '#6c6c6c', '#6d6d6d', '#6e6e6e', '#6f6f6f', '#707070', '#717171', '#717171', '#737373', '#747474', '#757575', '#767676', '#777777', '#787878', '#797979', '#797979', '#7b7b7b', '#7c7c7c', '#7d7d7d', '#7e7e7e', '#7f7f7f', '#808080', '#818181', '#828282', '#838383', '#838383', '#858585', '#868686', '#878787', '#888888', '#898989', '#8a8a8a', '#8b8b8b', '#8c8c8c', '#8d8d8d', '#8e8e8e', '#8f8f8f', '#909090', '#919191', '#929292', '#939393', '#939393', '#959595', '#969696', '#979797', '#989898', '#999999', '#9a9a9a', '#9b9b9b', '#9c9c9c', '#9d9d9d', '#9e9e9e', '#9f9f9f', '#a0a0a0', '#a1a1a1', '#a2a2a2', '#a3a3a3', '#a3a3a3', '#a5a5a5', '#a6a6a6', '#a7a7a7', '#a8a8a8', '#a9a9a9', '#aaaaaa', '#ababab', '#acacac', '#adadad', '#aeaeae', '#afafaf', '#b0b0b0', '#b1b1b1', '#b2b2b2', '#b3b3b3', '#b3b3b3', '#b5b5b5', '#b6b6b6', '#b7b7b7', '#b8b8b8', '#b9b9b9', '#bababa', '#bbbbbb', '#bcbcbc', '#bdbdbd', '#bebebe', '#bfbfbf', '#c0c0c0', '#c1c1c1', '#c2c2c2', '#c3c3c3', '#c3c3c3', '#c5c5c5', '#c6c6c6', '#c7c7c7', '#c8c8c8', '#c9c9c9', '#cacaca', '#cbcbcb', '#cccccc', '#cdcdcd', '#cecece', '#cfcfcf', '#d0d0d0', '#d1d1d1', '#d2d2d2', '#d3d3d3', '#d3d3d3', '#d5d5d5', '#d6d6d6', '#d7d7d7', '#d8d8d8', '#d9d9d9', '#dadada', '#dbdbdb', '#dcdcdc', '#dddddd', '#dedede', '#dfdfdf', '#e0e0e0', '#e1e1e1', '#e2e2e2', '#e3e3e3', '#e3e3e3', '#e5e5e5', '#e6e6e6', '#e7e7e7', '#e8e8e8', '#e9e9e9', '#eaeaea', '#ebebeb', '#ececec', '#ededed', '#eeeeee', '#efefef', '#f0f0f0', '#f1f1f1', '#f2f2f2', '#f3f3f3', '#f3f3f3', '#f5f5f5', '#f6f6f6', '#f7f7f7', '#f8f8f8', '#f9f9f9', '#fafafa', '#fbfbfb', '#fcfcfc', '#fdfdfd', '#fefefe', '#ffffff']
    ],
    normalize: function (idx) {
      var grad = ColorscaleGradients.gradients[idx];
      var len = grad.length - 1;
      return grad.map(function (_, i) {
        return [i / len, _];
      });
    }
  };
  return ColorscaleGradients;
});
angular.module('countries-list', []).service('countries', ["$http", function ($http) {
  var countries;
  return {
    get: function (callback) {
      if (countries) return callback(countries);
      $http.get('/legacy-api/orders/countries').success(function (data) {
        countries = data;
        callback(countries);
      });
    }
  };
}]);
angular.module('humane', []).factory('notify', ["$window", function ($window) {
  var humane = $window.humane;
  humane.timeout = 6000;
  humane.baseCls = "humane-original";
  humane.error = humane.spawn({
    addnCls: humane.baseCls + '-error'
  });
  humane.info = humane.spawn({
    addnCls: humane.baseCls + '-info'
  });
  humane.success = humane.spawn({
    addnCls: humane.baseCls + '-success'
  });

  humane.serverError = function () {
    humane.error("Error communicating with server");
  };

  return humane;
}]);
angular.module('a2.service.plotly-plot-maker', []).service('plotlyPlotMaker', function () {
  var plotlyPlotMaker = {
    range: function range(start, count, step) {
      var _ = [];

      for (var i = 0, x = start; i < count; ++i, x += step) {
        _.push(x);
      }

      return _;
    },
    mergeData: function mergeData(data, defaults) {
      return (data || []).map(function (datum) {
        return angular.merge(angular.copy(defaults[datum.type] || {}), datum);
      });
    },
    mergeLayout: function mergeLayout(layout, defaults) {
      return angular.merge(angular.copy(defaults.layout), layout);
    },
    makeHeatmapPlot: function (x, y, z, data, title) {
      var plot = {
        data: {
          type: 'heatmap',
          hoverinfo: 'x+y+z',
          colorbar: {
            title: z.title
          } // connectgaps:true,

        },
        layout: {
          title: title,
          xaxis: {
            boundsmode: 'auto',
            title: x.title,
            ticksuffix: x.units || ''
          },
          yaxis: {
            boundsmode: 'auto',
            title: y.title,
            ticksuffix: y.units || ''
          }
        }
      };

      if (data.rows) {
        plot.data.x = data.rows.map(function (_) {
          return data.x.min + data.x.step * _.x;
        });
        plot.data.y = data.rows.map(function (_) {
          return data.y.min + data.y.step * _.y;
        });
        plot.data.z = data.rows.map(function (_) {
          return _.z;
        });
      } else if (data.matrix) {
        plot.data.x = plotlyPlotMaker.range(data.x.min, data.x.bins, data.x.step);
        plot.data.y = plotlyPlotMaker.range(data.y.min, data.y.bins, data.y.step);
        plot.data.z = data.matrix;
      }

      return plot;
    },
    makeBarPlot: function (x, y, data, title) {
      var plot = {
        data: {
          orientation: 'v',
          type: 'bar'
        },
        layout: {
          title: title,
          xaxis: {
            boundsmode: 'auto',
            title: x.title,
            ticksuffix: x.units || ''
          },
          yaxis: {
            boundsmode: 'auto',
            title: y.title
          }
        }
      };

      if (data.rows) {
        plot.data.x = data.rows.map(function (_) {
          return data.x.min + data.x.step * _.x;
        });
        plot.data.y = data.rows.map(function (_) {
          return _.z;
        });
      } else if (data.matrix) {
        plot.data.x = plotlyPlotMaker.range(data.x.min, data.x.bins, data.x.step);
        plot.data.y = data.matrix[0];
      }

      return plot;
    }
  };
  return plotlyPlotMaker;
});
angular.module('a2-plot-specs', ['a2.utils-browser-metrics']).factory('PlotSpecs', ["a2BrowserMetrics", function (a2BrowserMetrics) {
  return {
    gutter: a2BrowserMetrics.scrollSize.height,
    axis_sizew: 60,
    axis_sizeh: 60,
    legend_axis_w: 45,
    legend_width: 60,
    legend_gutter: 30,
    axis_lead: 15
  };
}]);
angular.module('a2.service.plotly-defaults', ['a2-plot-specs', 'a2.service.colorscale-gradients']).provider('PlotlyDefaults', function () {
  var PlotlyDefaults = {
    defaults: {},
    set: function (newDefaults, extend) {
      if (extend) {
        PlotlyDefaults.defaults = angular.merge(defaults, newDefaults);
      } else {
        PlotlyDefaults.defaults = newDefaults;
      }
    },
    $get: ["PlotlyDefaultDefaults", function (PlotlyDefaultDefaults) {
      return angular.merge(PlotlyDefaultDefaults, PlotlyDefaults.defaults);
    }]
  };
  return PlotlyDefaults;
}).service('PlotlyDefaultDefaults', ["PlotSpecs", "ColorscaleGradients", function (PlotSpecs, ColorscaleGradients) {
  var defaults = {
    titlefont: {
      family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      size: '14px'
    },
    tickfont: {
      family: 'sans-serif',
      size: '11px',
      color: '#fff'
    }
  };
  defaults.config = {
    showLink: false,
    sendData: false,
    displaylogo: false,
    displayModeBar: true,
    scrollZoom: true,
    modeBarButtonsToRemove: ['sendDataToCloud', 'autoScale2d']
  };
  defaults.layout = {
    xaxis: {
      titlefont: defaults.titlefont,
      tickfont: defaults.tickfont,
      color: '#fff'
    },
    yaxis: {
      titlefont: defaults.titlefont,
      tickfont: defaults.tickfont,
      color: '#fff'
    },
    // margin:{l:70 + 25,r:0,b:25,t:50, pad:0},
    plot_bgcolor: '#131525',
    paper_bgcolor: '#131525',
    dragmode: 'pan'
  };
  defaults.colorbar = {
    tickfont: defaults.tickfont,
    thickness: PlotSpecs.legend_width - PlotSpecs.legend_axis_w
  };
  defaults.heatmap = {
    colorscale: ColorscaleGradients.normalize(0),
    colorbar: defaults.colorbar
  };
  return defaults;
}]);
angular.module('a2.url-update-service', []).factory('a2UrlUpdate', function () {
  return {
    cache: {},
    prefix: '_t_',
    clear: function () {
      this.cache = {};
    },
    update: function (url) {
      url = this.get(url);
      var qidx = url.indexOf('?');
      var url2;

      var _t_ = new Date().getTime();

      if (qidx >= 0) {
        var re = new RegExp('(^|&)' + this.prefix + '=(\\d+)');
        var query = url.substr(qidx + 1);
        var m = re.exec(query);

        if (m) {
          url2 = url.substr(0, qidx) + '?' + query.replace(re, this.prefix + '=' + _t_);
        } else {
          url2 = url + '&' + this.prefix + '=' + _t_;
        }
      } else {
        url2 = url + '?' + this.prefix + '=' + _t_;
      }

      this.cache[url] = url2;
      $('[src="' + url + '"]').attr('src', '').attr('src', url2);
    },
    get: function (url) {
      var url2;

      while (url2 = this.cache[url]) {
        url = url2;
      }

      return url;
    }
  };
}).filter('a2UpdatedUrl', ["a2UrlUpdate", function (a2UrlUpdate) {
  return function (url) {
    return a2UrlUpdate.get(url);
  };
}]);
angular.module('a2.utils.external-api-loader', ['a2.utils.global-anonymous-function']).provider('externalApiLoader', function () {
  var externalApiLoaderProvider = {
    apis: {},
    defaults: {
      getCachedModule: ["$window", function ($window) {
        return $window[this.def.namespace];
      }],
      loader: ["$window", "$q", "globalAnonymousFunction", function ($window, $q, globalAnonymousFunction) {
        var api = this;
        return $q(function (resolve, reject) {
          var url = api.def.url;
          var script = $window.document.createElement('script');
          angular.element($window.document.head).append(script);

          if (api.def.jsonpCallback) {
            url += (/\?/.test(url) ? '&' : '?') + api.def.jsonpCallback + '=' + globalAnonymousFunction(resolve, {
              oneTime: true
            }).id;
          } else {
            script.onload = resolve;
          }

          script.onerror = function () {
            reject();
          };

          script.src = url;
        });
      }]
    },
    addApi: function (apiName, def) {
      externalApiLoaderProvider.apis[apiName] = {
        name: apiName,
        def: angular.extend({}, externalApiLoaderProvider.defaults, def)
      };
    },
    $get: ["$q", "$injector", function ($q, $injector) {
      var externalApiLoader = {
        load: function (apiName) {
          var api = externalApiLoaderProvider.apis[apiName];

          if (!api) {
            return $q.reject("Cannot load unconfigured external api " + apiName);
          }

          if (!api.module) {
            api.module = $injector.invoke(api.def.getCachedModule, api);
          }

          if (!api.promise) {
            if (api.module) {
              api.promise = $q.resolve(api.module);
            } else {
              api.promise = $q.resolve();

              if (api.def.parent) {
                api.promise = api.promise.then(function () {
                  return externalApiLoader.load(api.def.parent);
                }).then(function () {
                  api.parent = externalApiLoaderProvider.apis[api.def.parent];
                });
              }

              api.promise = api.promise.then(function () {
                return $injector.invoke(api.def.loader, api);
              }).then(function () {
                api.module = $injector.invoke(api.def.getCachedModule, api);
              }).then(function () {
                if (api.def.onload) {
                  return $injector.invoke(api.def.onload, api);
                }
              }).then(function () {
                return api.module;
              });
            }
          }

          return api.promise;
        }
      };
      return externalApiLoader;
    }]
  };
  return externalApiLoaderProvider;
});
angular.module('a2.utils.global-anonymous-function', []).factory('globalAnonymousFunction', ["$window", function ($window) {
  var ct = 0;
  return function (fn, options) {
    // console.log("return function(fn, options)", fn, options);
    var wrapperFn = function () {
      if (options && options.oneTime) {
        wrapperFn.remove();
      }

      fn.apply(this, Array.prototype.slice.call(arguments));
    };

    wrapperFn.id = '__g_a_f_' + ct++;
    $window[wrapperFn.id] = wrapperFn;

    wrapperFn.remove = function () {
      if ($window[wrapperFn.id] == wrapperFn) {
        delete $window[wrapperFn.id];
      }
    };

    return wrapperFn;
  };
}]);
angular.module('a2.utils.q-promisify', []).factory('$qPromisify', ["$q", function ($q) {
  function $qPromisify()
  /*fn, ...args*/
  {
    var args = Array.prototype.slice.call(arguments);
    var fn = args.shift();
    return $q(function (resolve, reject) {
      args.push(function (err, value) {
        if (err) {
          reject();
        } else {
          resolve(value);
        }
      });
      fn.apply(null, args);
    });
  }

  $qPromisify.invoke = function ()
  /*object, method, ...args*/
  {
    var args = Array.prototype.slice.call(arguments);
    var object = args.shift();
    var method = args.shift();
    return $qPromisify(function (cb) {
      args.push(cb);
      object[method].apply(object, args);
    });
  };

  return $qPromisify;
}]);
angular.module('a2.admin.jobs', ['ui.router', 'templates-arbimon2']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.otherwise("/dashboard");
  $stateProvider.state('jobs', {
    url: '/jobs',
    controller: 'AdminJobsCtrl',
    templateUrl: '/admin/jobs/index.html'
  });
}]).controller('AdminJobsCtrl', ["$scope", "$http", "$interval", "Project", function ($scope, $http, $interval, Project) {
  var getJobQueueInfo = function (argument) {
    $http.get('/admin/job-queue').success(function (data) {
      $scope.jobsStatus = data;
    });
  };

  $scope.findJobs = function () {
    var query = {};
    var getTags = /(\w+):["'](.+)["']|(\w+):([\w\-]+)/g;

    if ($scope.params.search) {
      // iterate over getTags results
      $scope.params.search.replace(getTags, function (match, key1, value1, key2, value2) {
        // key1 matches (\w+):["'](.+)["']
        // key2 matches (\w+):([\w\-]+)
        var key = key1 ? key1 : key2;
        var value = value1 ? value1 : value2;
        if (!query[key]) query[key] = [];
        query[key].push(value);
      });
    }

    if ($scope.params.states) {
      query.states = $scope.params.states.map(function (s) {
        return s.name;
      });
    }

    if ($scope.params.types) {
      query.types = $scope.params.types.map(function (t) {
        return t.id;
      });
    }

    $http.get('/admin/jobs', {
      params: query
    }).success(function (data) {
      $scope.activeJobs = data; // console.log(query);
    });
  };

  $scope.initParams = function () {
    $scope.params = {
      search: "is:visible "
    };
  };

  $scope.job_types = [];
  $scope.states = [{
    name: 'waiting',
    color: 'black',
    show: true
  }, {
    name: 'initializing',
    color: 'blue',
    show: true
  }, {
    name: 'ready',
    color: '#007777',
    show: true
  }, {
    name: 'processing',
    color: 'olive',
    show: true
  }, {
    name: 'completed',
    color: 'green',
    show: false
  }, {
    name: 'error',
    color: 'red',
    show: true
  }, {
    name: 'canceled',
    color: 'gray',
    show: false
  }, {
    name: 'stalled',
    color: 'gray',
    show: false
  }];
  $scope.initParams();
  getJobQueueInfo();
  $http.get('/legacy-api/jobs/types').success(function (jobTypes) {
    var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528'];
    $scope.colors = {};

    for (var i = 0; i < jobTypes.length; i++) {
      var t = jobTypes[i];
      $scope.colors[t.name] = colors[i % colors.length];
    }

    $scope.job_types = jobTypes;
  });
  $scope.findJobs();
}]);
angular.module('a2.admin.dashboard.data-service', []).service('AdminDashboardDataService', ["$q", function ($q) {
  return {
    getPlotData: function (series, from, to, period) {
      return $q.when('/admin/plot-data/data.txt?stat=' + series + '&q=' + period + '&from=' + from.getTime() + '&to=' + to.getTime());
    }
  };
}]);
angular.module('a2.admin.dashboard', ['ui.router', 'ui.bootstrap', 'a2.utils', 'a2.services', 'a2.directives', 'templates-arbimon2', 'humane', 'ui.select', 'a2.admin.dashboard.data-service', 'a2.admin.dashboard.plotter-controller']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.otherwise("/dashboard");
  $stateProvider.state('dashboard', {
    url: '/dashboard',
    controller: 'AdminDashboardCtrl as controller',
    templateUrl: '/admin/dashboard/index.html'
  });
}]).controller('AdminDashboardCtrl', ["$scope", "$http", "$q", "$controller", function ($scope, $http, $q, $controller) {
  $scope.plots = $controller('AdminDashboardPlotterController', {
    '$scope': $scope
  });

  $scope.UserStatsExport = function () {
    $http.get('/admin/all-users').success(function (data) {
      download(data);
    });
  };

  $http.get('/admin/dashboard-stats').success(function (data) {
    $scope.newUsers = data.newUsers;
    $scope.newProjects = data.newProjects;
    $scope.Jobs = data.jobsStatus;
    $scope.allUsers = data.allUsers;
    $scope.allSites = data.allSites;
    $scope.allProjects = data.allProjects;
    $scope.newSites = data.newSites;
  });

  $scope.getSystemSettings = function () {
    $http.get('/admin/system-settings').success(function (data) {
      $scope.settings = data;
    });
  };

  $scope.getSystemSettings();

  $scope.setSetting = function (setting, value) {
    var d = $q.defer();

    if (!setting) {
      d.resolve();
    } else {
      $http.put('/admin/system-settings', {
        setting: setting,
        value: value
      }).success(function (data) {
        $scope.getSystemSettings();
        d.resolve(data[setting]);
      }).error(function (data) {
        console.error(data);
        $scope.getSystemSettings();
        d.reject(data);
      });
    }

    return d.promise;
  };

  $scope.toggleSetting = function (setting) {
    var value = $scope.settings[setting] == 'on' ? 'off' : 'on';
    return this.setSetting(setting, value);
  };

  function convertToCSV(objArray) {
    var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    var str = '';

    for (var i = 0; i < array.length; i++) {
      var line = '';

      for (var index in array[i]) {
        if (line != '') line += ',';
        line += array[i][index];
      }

      str += line + '\r\n';
    }

    return str;
  }

  function exportCSVFile(headers, items, fileTitle) {
    if (headers) {
      items.unshift(headers);
    } // Convert Object to JSON


    var jsonObject = JSON.stringify(items);
    var csv = convertToCSV(jsonObject);
    var exportedFilenmae = fileTitle + '.csv' || 'export.csv';
    var blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });

    if (navigator.msSaveBlob) {
      // IE 10+
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

  function download(data) {
    var headers = {
      name: 'Name',
      email: "Email"
    };
    var itemsFormatted = []; // format the data

    data.forEach(function (item) {
      itemsFormatted.push({
        name: item.firstname + " " + item.lastname,
        email: item.email
      });
    });
    exportCSVFile(headers, itemsFormatted, 'users');
  }
}]);
angular.module('a2.admin.dashboard.plotter-controller', ['templates-arbimon2', 'a2.admin.dashboard.data-service', 'a2.directive.plotly-plotter']).controller('AdminDashboardPlotterController', ["$scope", "$window", "$q", "AdminDashboardDataService", function ($scope, $window, $q, AdminDashboardDataService) {
  function mk_time_range_fn(from, delta) {
    return function () {
      var fromdt = from == 'now' ? new Date() : new Date(from);
      var todt = new Date(fromdt.getTime() + delta);

      if (delta < 0) {
        var t = fromdt;
        fromdt = todt;
        todt = t;
      }

      return [fromdt, todt];
    };
  }

  function get_by_tag(arr, tag) {
    return arr.filter(function (x) {
      return x.tag == tag;
    }).shift();
  }

  function make_setter(options) {
    var attr = options.data;
    var selattr = options.sel || attr;
    var def = options.def;
    return function set(value) {
      if (typeof value == 'string') {
        value = get_by_tag(this.data[attr], value);
      }

      if (!value) {
        value = get_by_tag(this.data[attr], def);
      }

      this.selected[selattr] = value;

      if (value.apply) {
        value.apply(this);
      }

      return this.refresh_logs();
    };
  }

  this.data = {
    series: [{
      tag: 'activity',
      name: 'Activity',
      icon: 'fa fa-fw fa-ra'
    } // {tag:'voltage', name:'Voltage', icon:'fa fa-fw fa-bolt'},
    // {tag:'power', name:'Power', icon:'fa fa-fw fa-battery-half'}
    ],
    time_ranges: [{
      tag: '1-hour',
      text: 'Last Hour',
      range: mk_time_range_fn('now', -3600 * 1000)
    }, {
      tag: '3-hour',
      text: 'Last 3 Hours',
      range: mk_time_range_fn('now', -3 * 3600 * 1000)
    }, {
      tag: '6-hour',
      text: 'Last 6 Hours',
      range: mk_time_range_fn('now', -6 * 3600 * 1000)
    }, {
      tag: '12-hour',
      text: 'Last 12 Hours',
      range: mk_time_range_fn('now', -12 * 3600 * 1000)
    }, {
      tag: '24-hour',
      text: 'Last 24 Hours',
      range: mk_time_range_fn('now', -24 * 3600 * 1000)
    }, {
      tag: '3-days',
      text: 'Last 3 Days',
      range: mk_time_range_fn('now', -3 * 24 * 3600 * 1000)
    }, {
      tag: '1-week',
      text: 'Last Week',
      range: mk_time_range_fn('now', -7 * 24 * 3600 * 1000)
    }, {
      tag: '2-weeks',
      text: 'Last 2 Weeks',
      range: mk_time_range_fn('now', -14 * 24 * 3600 * 1000)
    }, {
      tag: '1-month',
      text: 'Last Month',
      range: mk_time_range_fn('now', -31 * 24 * 3600 * 1000)
    }],
    periods: [{
      tag: '1-minute',
      text: '1 Minute',
      sampling: '1 min',
      granularity: 1 * 60 * 1000
    }, {
      tag: '5-minutes',
      text: '5 Minutes',
      sampling: '5 mins',
      granularity: 5 * 60 * 1000
    }, {
      tag: '10-minutes',
      text: '10 Minutes',
      sampling: '10 mins',
      granularity: 10 * 60 * 1000
    }, {
      tag: '30-minutes',
      text: '30 Minutes',
      sampling: '30 mins',
      granularity: 30 * 60 * 1000
    }, {
      tag: '1-hour',
      text: '1 Hour',
      sampling: '1 hour',
      granularity: 1 * 60 * 60 * 1000
    }, {
      tag: '3-hours',
      text: '3 Hours',
      sampling: '3 hours',
      granularity: 3 * 60 * 60 * 1000
    }, {
      tag: '6-hours',
      text: '6 Hours',
      sampling: '6 hours',
      granularity: 6 * 60 * 60 * 1000
    }, {
      tag: '1-day',
      text: '1 Day',
      sampling: '1 day',
      granularity: 24 * 60 * 60 * 1000
    }] // min_date: 0,
    // max_date: 10000,

  };
  this.loading = {};
  this.selected = {
    series: get_by_tag(this.data.series, 'activity'),
    time_range: get_by_tag(this.data.time_ranges, '1-week'),
    period: get_by_tag(this.data.periods, '1-day')
  };
  this.set_series = make_setter({
    data: 'series',
    sel: 'series',
    def: 'activity'
  });
  this.set_time_range = make_setter({
    data: 'time_ranges',
    sel: 'time_range',
    def: '1-week'
  });
  this.set_period = make_setter({
    data: 'periods',
    sel: 'period',
    def: '1-day'
  });

  this.load_data = function (series, range, period) {
    var loading = this.loading;
    loading.data = true;
    return AdminDashboardDataService.getPlotData(series.tag, range[0], range[1], period.sampling).then(function (data) {
      loading.data = false;
      return {
        x: 'datetime',
        url: data
      };
    });
  };

  this.make_chart_struct = function (data) {
    return $q(function (resolve, reject) {
      $window.Plotly.d3.csv(data.url, function (err, data) {
        if (err) {
          reject(err);
        } else if (data) {
          resolve(data);
        }
      });
    }).then(function (data) {
      this.chart = {
        data: [{
          type: 'scatter',
          mode: 'lines',
          marker: {
            color: '#31984f'
          },
          x: data.map(function (_) {
            return new Date(+_.datetime).toString();
          }),
          y: data.map(function (_) {
            return +_.activity;
          })
        }],
        layout: {
          xaxis: {
            boundsmode: 'auto'
          },
          yaxis: {
            boundsmode: 'auto'
          }
        } // axes : {
        //     x : {
        //         tick: {
        //             format: function (x) {
        //                 return moment(new Date(x)).utc().format('MM-DD-YYYY HH:mm');
        //             }
        //         }
        //     }
        // }

      };
      console.log(this.chart);
    }.bind(this));
  };

  this.refresh_logs = function () {
    var d = $q.defer(),
        promise = d.promise;
    d.resolve();
    var series = this.selected.series;
    var time_range = this.selected.time_range;
    var period = this.selected.period;

    if (series && time_range && period) {
      var range = time_range.range();
      var granularity = period.granularity;
      promise = d.promise.then(function () {
        if (series.data) {
          if (series.data.period != period || !(series.data.range[0] - granularity >= range[0] && range[1] <= series.data.range[1] + granularity)) {
            series.data = null;
          }
        }

        if (!series.data) {
          return this.load_data(series, range, period).then(function (data) {
            series.data = {
              data: data,
              range: range,
              period: period
            };
            return series.data.data;
          });
        } else {
          return series.data.data;
        }
      }.bind(this)).then(function (chart_data) {
        console.log("chart_data : ", chart_data);

        if (chart_data) {
          this.make_chart_struct(chart_data);
        }
      }.bind(this));
    }

    return promise;
  };

  $q.when().then(this.refresh_logs.bind(this));
}]);
angular.module('a2.admin.projects.codes', ['ui.router', 'a2.directives', 'ui.bootstrap', 'a2.utils', 'a2.services', 'templates-arbimon2', 'humane', 'ui.select', 'a2.admin.projects.list', 'a2.admin.users.list']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('projects.codes', {
    url: '/codes',
    controller: 'AdminProjectsCodesCtrl as controller',
    templateUrl: '/admin/projects/codes.html'
  });
}]).controller('AdminProjectsCodesCtrl', ["$modal", "notify", "LoaderFactory", "AdminProjectsCodesService", function ($modal, notify, LoaderFactory, AdminProjectsCodesService) {
  var loader = LoaderFactory.newInstance();
  this.loader = loader;

  this.createNewCode = function () {
    return $modal.open({
      templateUrl: '/admin/projects/new-code-modal.html',
      resolve: {
        projectsList: ["AdminProjectsListService", function (AdminProjectsListService) {
          return AdminProjectsListService.getList();
        }],
        usersList: ["AdminUsersListService", function (AdminUsersListService) {
          return AdminUsersListService.getList();
        }]
      },
      controller: ["projectsList", "usersList", function (projectsList, usersList) {
        this.projectsList = projectsList;
        this.usersList = usersList;
        this.data = {
          lockToUser: undefined,
          lockProject: undefined,
          duration: 1,
          recordings: 10000,
          processing: 1000000,
          tieProcessingWithRecordings: true
        };

        this.computeProcessingAmount = function () {
          if (this.data.tieProcessingWithRecordings) {
            this.data.processing = this.data.recordings * 100;
          }
        };

        this.processingCountChanged = function () {
          this.data.tieProcessingWithRecordings = false;
        };
      }],
      controllerAs: 'popup'
    }).result.then(AdminProjectsCodesService.createNewCode).then(function () {
      loader.load(this, 'codes', AdminProjectsCodesService.loadCodes());
    }.bind(this));
  };

  this.showHash = function (code) {
    return $modal.open({
      templateUrl: '/admin/projects/view-hash.html',
      resolve: {
        code: function () {
          return code;
        }
      },
      controller: ["code", function (code) {
        this.code = code;
      }],
      controllerAs: 'popup'
    });
  }; // editSelectedCode
  // deleteSelectedCode


  loader.load(this, 'codes', AdminProjectsCodesService.loadCodes());
}]).service('AdminProjectsCodesService', ["$http", function ($http) {
  return {
    loadCodes: function () {
      return $http.get('/admin/projects/codes').then(function (response) {
        return response.data;
      });
    },
    createNewCode: function (data) {
      console.log("createNewCode", data);
      return $http.post('/admin/projects/codes', {
        user: data.lockToUser && data.lockToUser.id,
        project: data.lockProject && data.lockProject.id,
        recordings: data.recordings,
        duration: data.duration,
        processing: data.processing
      }).then(function (data) {
        return data.response;
      });
    }
  };
}]).factory('LoaderFactory', ["$q", function ($q) {
  function Loader() {
    this.loading = {};
  }

  Loader.prototype = {
    load: function (valueStore, key, promise) {
      this.loading[key] = true;
      return promise.then(function (value) {
        this.loading[key] = false;

        if (valueStore) {
          valueStore[key] = value;
        }

        return value;
      }.bind(this), function (err) {
        this.loading[key] = false;
        throw err;
      }.bind(this));
    }
  };
  return {
    newInstance: function () {
      return new Loader();
    }
  };
}]);
angular.module('a2.admin.projects', ['ui.router', 'templates-arbimon2', 'a2.admin.projects.list', 'a2.admin.projects.codes']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.otherwise("/dashboard");
  $stateProvider.state('projects', {
    url: '/projects',
    abstract: true,
    templateUrl: '/admin/projects/index.html'
  });
}]);
angular.module('a2.admin.projects.list', ['ui.router', 'ui.bootstrap', 'a2.utils', 'a2.services', 'templates-arbimon2', 'a2.orders.directives.tier-select', 'humane', 'ui.select']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('projects.list', {
    url: '',
    controller: 'AdminProjectsListCtrl as controller',
    templateUrl: '/admin/projects/list.html'
  }).state('projects.list.detail', {
    url: '/:url',
    views: {
      'detail': {
        templateUrl: '/admin/projects/list-detail.html',
        controller: 'AdminProjectsListDetailCtrl as controller'
      }
    }
  });
}]).controller('AdminProjectsListCtrl', ["$scope", "$state", "AdminProjectsListService", function ($scope, $state, AdminProjectsListService) {
  this.initialize = function () {
    AdminProjectsListService.getList().then(function (data) {
      this.projects = data;

      if ($state.params.url) {
        var url = $state.params.url;
        this.selected = this.projects.reduce(function (_, project) {
          return project.url == url ? project : _;
        }, null);
      }
    }.bind(this));
  };

  this.select = function (project) {
    return $state.go('projects.list.detail', {
      url: project.url
    });
  };

  this.notifyProjectUpdated = function (project) {
    var projectObject = this.projects.reduce(function (_, p, $index) {
      return p.project_id == project.project_id ? project : _;
    }, null);
    angular.merge(projectObject, project);
  };

  this.initialize();
}]).controller('AdminProjectsListDetailCtrl', ["$scope", "$state", "$q", "notify", "AdminProjectsListService", function ($scope, $state, $q, notify, AdminProjectsListService) {
  this.initialize = function () {
    console.log("$state", $state);
    this.setProject({
      url: $state.params.url
    });
  };

  this.setProject = function (projectData) {
    return $q.all([AdminProjectsListService.getProjectInfo(projectData), AdminProjectsListService.getProjectSites(projectData), AdminProjectsListService.getProjectRecordingCount(projectData)]).then(function (all) {
      this.project = all[0];
      this.project.is_enabled = this.project.is_enabled | 0;
      this.sites = all[1];
      this.recCount = all[2];
    }.bind(this));
  };

  this.close = function () {
    $state.go('projects.list');
  };

  this.save = function () {
    return AdminProjectsListService.updateProject(this.project).then(function (project) {
      this.project = project;
      notify.log("Project " + project.name + " info updated.");
    }.bind(this)).catch(function (err) {
      notify.error(err);
    });
  };

  this.handleAedToggle = function () {
    this.project.clustering_enabled = this.project.aed_enabled;
  };

  this.initialize();
}]).service('AdminProjectsListService', ["$http", function ($http) {
  return {
    getList: function () {
      return $http.get('/admin/projects').then(function (response) {
        return response.data;
      });
    },
    getProjectInfo: function (project) {
      return $http.get('/legacy-api/project/' + project.url + '/info').then(function (response) {
        var data = response.data;
        data.is_enabled = !!data.is_enabled;
        return data;
      });
    },
    getProjectSites: function (project) {
      return $http.get('/legacy-api/project/' + project.url + '/sites').then(function (response) {
        return response.data;
      });
    },
    getProjectRecordingCount: function (project) {
      return $http.get('/legacy-api/project/' + project.url + '/recordings/count').then(function (response) {
        return response.data.count;
      });
    },
    updateProject: function (project) {
      var projectData = {
        project_id: project.project_id,
        name: project.name,
        url: project.url,
        description: project.description,
        project_type_id: project.project_type_id,
        is_private: project.is_private,
        is_enabled: project.is_enabled,
        current_plan: project.current_plan,
        storage_usage: project.storage_usage,
        processing_usage: project.processing_usage,
        citizen_scientist_enabled: !!project.citizen_scientist_enabled,
        cnn_enabled: !!project.cnn_enabled,
        pattern_matching_enabled: !!project.pattern_matching_enabled,
        aed_enabled: !!project.aed_enabled,
        clustering_enabled: !!project.clustering_enabled,
        reports_enabled: !!project.reports_enabled,
        plan: {
          tier: project.tier,
          storage: project.storage_limit,
          processing: project.processing_limit,
          activation: project.plan_activated,
          duration_period: project.plan_period
        }
      };
      return $http.put('/admin/projects/' + project.project_id, {
        project: projectData
      }).then(function (response) {
        return response.data;
      });
    }
  };
}]);
angular.module('a2.admin.users.list', ['ui.router', 'ui.bootstrap', 'a2.utils', 'a2.services', 'templates-arbimon2', 'humane', 'ui.select']) // .config(function($stateProvider, $urlRouterProvider) {
//     $stateProvider
//         .state('users.list', {
//             url: '',
//             controller:'AdminUsersListCtrl',
//             templateUrl: '/admin/users/list.html'
//         });
// 
// })
// .controller('AdminUsersCtrl', function($scope, $http) {
//     $http.get('/admin/users')
//         .success(function(data) {
//             $scope.users = data;
//         });
// })
.service('AdminUsersListService', ["$http", function ($http) {
  return {
    getList: function () {
      return $http.get('/admin/users').then(function (response) {
        return response.data;
      });
    }
  };
}]);
angular.module('a2.analysis', ['a2.analysis.patternmatching', 'a2.directive.audio-bar', 'a2.analysis.random-forest-models', 'a2.analysis.cnn', 'a2.analysis.soundscapes', 'a2.analysis.audio-event-detection', 'a2.analysis.audio-event-detections-clustering', 'a2.analysis.clustering-jobs', 'ui.router', 'ct.ui.router.extras', 'a2.srv.api']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.when("/analysis", "/analysis/patternmatching", "/analysis/clustering-jobs");
  $stateProvider.state('analysis', {
    url: '/analysis',
    views: {
      'analysis': {
        controller: 'AnalysisIndexCtrl as controller',
        templateUrl: '/app/analysis/index.html'
      }
    },
    deepStateRedirect: true,
    sticky: true
  });
}]).controller('AnalysisIndexCtrl', ["$scope", "Project", "a2UserPermit", function ($scope, Project, a2UserPermit) {
  Project.getInfo(function (info) {
    $scope.project = info;
  });
}]);
angular.module('a2.audiodata', ['ui.router', 'ct.ui.router.extras', 'a2.directive.sidenav-bar', 'a2.directive.audio-bar', 'a2.audiodata.sites', 'a2.audiodata.species', 'a2.audiodata.uploads', 'a2.audiodata.recordings', 'a2.audiodata.training-sets', 'a2.audiodata.playlists', 'a2.audiodata.templates', 'a2.audiodata.soundscape-composition-classes']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.when("/audiodata", "/audiodata/sites");
  $stateProvider.state('audiodata', {
    url: '/audiodata',
    views: {
      'audiodata': {
        controller: 'AudiodataIndexCtrl as controller',
        templateUrl: '/app/audiodata/index.html'
      }
    },
    deepStateRedirect: true,
    sticky: true
  }).state('audiodata.sites', {
    url: '/sites?site&show',
    controller: 'SitesCtrl',
    templateUrl: '/app/audiodata/sites.html'
  }).state('audiodata.species', {
    url: '/species',
    controller: 'SpeciesCtrl',
    templateUrl: '/app/audiodata/species.html'
  }).state('audiodata.trainingSets', {
    url: '/training-sets?set&show',
    controller: 'TrainingSetsCtrl as controller',
    templateUrl: '/app/audiodata/training-sets.html'
  });
}]).controller('AudiodataIndexCtrl', ["$scope", "Project", "a2UserPermit", function ($scope, Project, a2UserPermit) {
  Project.getInfo(function (info) {
    $scope.project = info;
  });
}]);
angular.module('a2.audiodata.sites', ['a2.services', 'a2.directives', 'ui.bootstrap', 'humane', 'a2.qr-js', 'a2.googlemaps', 'a2.srv.project']).directive('fileChange', ['$parse', function ($parse) {
  return {
    require: 'ngModel',
    restrict: 'A',
    link: function ($scope, element, attrs) {
      var attrHandler = $parse(attrs['fileChange']);

      var handler = function (e) {
        $scope.$apply(function () {
          attrHandler($scope, {
            $event: e,
            files: e.target.files
          });
        });
      };

      element[0].addEventListener('change', handler, false);
    }
  };
}]).controller('SitesCtrl', ["$scope", "$state", "$anchorScroll", "Project", "$modal", "notify", "a2Sites", "$window", "$controller", "$q", "a2UserPermit", "a2GoogleMapsLoader", "$downloadResource", function ($scope, $state, $anchorScroll, Project, $modal, notify, a2Sites, $window, $controller, $q, a2UserPermit, a2GoogleMapsLoader, $downloadResource) {
  $scope.loading = true;
  $scope.markers = [];
  $scope.search = '';
  $scope.editing = false;
  $scope.creating = false;
  Project.getInfo(function (info) {
    $scope.project = info;
  });
  var p = {
    site: $state.params.site,
    show: $state.params.show
  };

  if (p.show) {
    p.show_path = p.show.split(':');
    p.show = p.show_path.shift();
  }

  Project.getSites({
    count: true,
    logs: true,
    deployment: true
  }, function (sites) {
    $scope.sortByLastUpdated(sites);
    $scope.loading = false;

    if (p.site) {
      var site = sites.filter(function (s) {
        return s.id == p.site;
      }).shift();

      if (site && site.id) {
        $scope.sel(site).then(function () {
          if (p.show) {
            $scope.set_show(p.show, p.show_path);
          }
        });
      }
    }

    a2GoogleMapsLoader.then(function (google) {
      $scope.map = new google.maps.Map($window.document.getElementById('mapSite'), {
        center: {
          lat: 0,
          lng: 0
        },
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        zoom: 8,
        minZoom: 2
      });
      $scope.fitBounds();
    });
    $scope.mapHeader = $window.document.getElementById('mapHeader');
    $scope.mapHeaderPosition = mapHeader.getBoundingClientRect();
  });

  $scope.fitBounds = function () {
    const bounds = new google.maps.LatLngBounds();
    angular.forEach($scope.sites, function (site) {
      if (site.lat > 85 || site.lat < -85 || site.lon > 180 || site.lon < -180) {
        return;
      }

      var marker;
      const position = new google.maps.LatLng(site.lat, site.lon); // set custop pin to selected site

      if ($scope.selected && $scope.selected.id === site.id) {
        marker = new google.maps.Marker({
          position: position,
          title: site.name,
          icon: {
            url: 'http://icons.iconarchive.com/icons/paomedia/small-n-flat/48/map-marker-icon.png'
          }
        });
      } else {
        marker = new google.maps.Marker({
          position: position,
          title: site.name
        });
      } // add draggable layer for an editig site


      if (($scope.editing || $scope.creating) && $scope.temp && $scope.temp.id === site.id) {
        marker.setDraggable(true);
        $scope.map.panTo(position);
        $scope.map.setZoom(8);
        google.maps.event.addListener(marker, 'dragend', function (position) {
          $scope.$apply(function () {
            $scope.temp.lat = position.latLng.lat();
            $scope.temp.lon = position.latLng.lng();
          });
        });
      }

      marker.addListener("click", function () {
        $scope.sel(site);
        $scope.scrollTo(site.id);
      });
      $scope.markers.push(marker);
      bounds.extend(position);
    });
    $scope.map.fitBounds(bounds);

    if ($scope.markers.length) {
      $scope.setMapOnAll($scope.map);
    }

    ;
  };

  $scope.scrollTo = function (id) {
    const bookmark = 'site-' + id;
    $anchorScroll.yOffset = 60;
    console.log(bookmark);
    $anchorScroll(bookmark);
  };

  $scope.onScroll = function ($event, $controller) {
    this.scrollElement = $controller.scrollElement;
    this.scrollPos = $controller.scrollElement.scrollY;
    $scope.scrollPos = this.scrollPos;
    $scope.scrolledPastHeader = this.scrollPos < 600;
  };

  $scope.getMapHeaderTop = function () {
    // calculate top offset for the map
    const defaultOffset = '122px';

    if ($scope.mapHeaderPosition) {
      const topOffset = $scope.mapHeaderPosition.top + $scope.mapHeader.offsetHeigh;
      return topOffset < 1 ? defaultOffset : topOffset;
    } else return defaultOffset;
  };

  $scope.scrollMap = function ($event, $controller) {
    return $scope.show.map && $scope.editing === false && $scope.creating === false && $scope.sites && $scope.sites.length > 15 && $scope.scrollPos;
  }, $scope.onFilterChanged = function () {
    $scope.sites = $scope.sortByKeywordArray($scope.originalSites, $scope.search);
  };

  $scope.sortByKeywordArray = function (array, keyword) {
    if (array && !array.length) return [];
    return array.filter(function (item) {
      // Filter results by doing case insensitive match on name
      return item.name.toLowerCase().includes(keyword.toLowerCase());
    }).sort(function (a, b) {
      // Sort results by matching name with keyword position in name
      if (a.name.toLowerCase().indexOf(keyword.toLowerCase()) > b.name.toLowerCase().indexOf(keyword.toLowerCase())) {
        return 1;
      } else if (a.name.toLowerCase().indexOf(keyword.toLowerCase()) < b.name.toLowerCase().indexOf(keyword.toLowerCase())) {
        return -1;
      } else {
        if (a.name > b.name) return 1;else return -1;
      }
    });
  };

  $scope.sortByLastUpdated = function (sites) {
    $scope.sites = sites.sort(function (a, b) {
      return a.updated_at < b.updated_at ? 1 : -1;
    });
    $scope.originalSites = $scope.sites;
  }; // Sets the map on all markers in the array


  $scope.setMapOnAll = function (map) {
    for (var i = 0; i < $scope.markers.length; i++) {
      $scope.markers[i].setMap(map);
    }
  }; // Removes the markers from the map, but keeps them in the array


  $scope.clearMarkers = function () {
    $scope.setMapOnAll(null);
  }; // Shows any markers currently in the array


  $scope.showMarkers = function (map) {
    $scope.setMapOnAll(map);
  }; // Deletes all markers in the array by removing references to them


  $scope.deleteMarkers = function () {
    $scope.clearMarkers();
    $scope.markers = [];
  };

  $scope.editing = false;

  $scope.importSite = function () {
    if (!a2UserPermit.can('manage project sites')) {
      notify.error("You do not have permission to add sites");
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: "/app/audiodata/import.html",
      controller: "ImportSiteInstanceCtrl"
    });
    modalInstance.result.then(function (response) {
      // Check the file is valid
      const sites = parseSitesFromCsv(response);

      if (!sites) {
        notify.error("Wrong format of csv file");
        return;
      } // Save the sites


      createSites(sites).then(function () {
        notify.log("Sites created"); // Refresh data

        Project.getSites({
          count: true,
          logs: true,
          deployment: true
        }, function (sites) {
          $scope.sortByLastUpdated(sites);
        });
      }).catch(function (error) {
        notify.error("Error: " + error);
      });
    });
  };

  function parseSitesFromCsv(allText) {
    var allTextLines = allText.split(/\r\n|\n/);
    var headers = allTextLines[0].split(',');

    if (!headers.includes("name") || !headers.includes("lat") || !headers.includes("lon") || !headers.includes("alt")) {
      return false;
    }

    var sites = [];

    for (var i = 1; i < allTextLines.length; i++) {
      var data = allTextLines[i].split(',');

      if (data.length == headers.length) {
        var site = {};

        for (var j = 0; j < headers.length; j++) {
          if (headers[j] === "lat" && (data[j] > 85 || data[j] < -85)) {
            return notify.log('Please enter latitude number between -85 to 85');
          }

          if (headers[j] === "lon" && (data[j] > 180 || data[j] < -180)) {
            return notify.log('Please enter longitude number between -180 to 180');
          }

          site[headers[j]] = data[j];
        }

        sites.push(site);
      }
    }

    return sites;
  }

  function createSites(sites) {
    return Promise.all(sites.map(function (site) {
      return new Promise(function (resolve, reject) {
        a2Sites.create(site, function (data) {
          if (data.error) {
            reject(data.error);
          } else {
            resolve();
          }
        });
      });
    }));
  }

  ;

  $scope.close = function () {
    $scope.creating = false;
    $scope.editing = false;

    if ($scope.marker) {
      a2GoogleMapsLoader.then(function (google) {
        var position = new google.maps.LatLng($scope.selected && $scope.selected.lat, $scope.selected && $scope.selected.lon);
        $scope.marker.setDraggable(false);
        $scope.marker.setPosition(position);
        $scope.marker.setTitle($scope.selected && $scope.selected.name);
      });
    }
  };

  $scope.exportSites = function () {
    if (a2UserPermit.isSuper()) return $downloadResource(Project.getSitesExportUrl());

    if (a2UserPermit.all && !a2UserPermit.all.length || !a2UserPermit.can('export report')) {
      return notify.error('You do not have permission to export sites');
    } else $downloadResource(Project.getSitesExportUrl());
  };

  $scope.status_controller = $controller('SiteStatusPlotterController', {
    '$scope': $scope
  });
  var onLogsRefreshed = $scope.status_controller.on('logs-refreshed', function (logParams) {
    if ($scope.show.status) {
      var new_show = [$state.params.show.split(':').slice(0, 1)].concat(logParams).join(':');
      console.log("logParams", logParams, new_show);
      $state.transitionTo($state.current.name, {
        site: $state.params.site,
        show: new_show
      }, {
        notify: false
      });
    }
  });
  $scope.$on('$destroy', function () {
    $scope.status_controller.off('logs-refreshed', onLogsRefreshed);
  });

  $scope.save = function () {
    var action = $scope.editing ? 'update' : 'create';

    if ($scope.temp.lat > 85 || $scope.temp.lat < -85) {
      notify.log('Please enter latitude number between -85 to 85');
      return;
    }

    if ($scope.temp.lon > 180 || $scope.temp.lon < -180) {
      notify.log('Please enter longitude number between -180 to 180');
      return;
    }

    if ($scope.siteForm.$invalid) return;
    var tempObj = Object.assign({}, $scope.temp); // Do not include equal location metadata / updated at data to the update endpoint.

    if (action === 'update') {
      const attrArray = ['alt', 'updated_at'];

      for (var i = 0; i < attrArray.length; i++) {
        var key = attrArray[i];

        if ($scope.temp[key] === $scope.selected[key]) {
          delete tempObj[key];
        }
      }

      const locationArray = ['lat', 'lon'];

      if ($scope.temp[locationArray[0]] === $scope.selected[locationArray[0]] && $scope.temp[locationArray[1]] === $scope.selected[locationArray[1]]) {
        delete tempObj[locationArray[0]];
        delete tempObj[locationArray[1]];
      }
    }

    a2Sites[action](action === 'create' ? $scope.temp : tempObj, function (data) {
      if (data.error) return notify.error(data.error);

      if (action === 'create') {
        $scope.creating = false;
      } else {
        $scope.editing = false;
      }

      Project.getSites({
        count: true,
        logs: true,
        deployment: true
      }, function (sites) {
        $scope.sortByLastUpdated(sites);
        $scope.sel(action === 'create' ? $scope.temp : tempObj).then(function () {
          if (p.show) {
            $scope.set_show(p.show, p.show_path);
          }
        }); // rebuild map pins

        $scope.deleteMarkers();
        $scope.fitBounds();
      });
      var message = action == "update" ? "Site updated" : "Site created";
      notify.log(message);
    });
  };

  $scope.del = function () {
    if (!$scope.selected) {
      notify.log('Please select site to remove');
      return;
    }

    if (!a2UserPermit.can('delete site')) {
      notify.error("You do not have permission to remove sites");
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      controller: function () {
        this.messages = ["Are you sure you would like to remove the following site?", $scope.selected.name];
        this.btnOk = "Delete";
        this.btnCancel = "Cancel";
      },
      controllerAs: 'popup'
    });
    modalInstance.result.then(function () {
      a2Sites.delete([$scope.selected.id], function (data) {
        if (data.error) return notify.error(data.error);
        Project.getSites({
          count: true,
          logs: true,
          deployment: true
        }, function (sites) {
          $scope.sortByLastUpdated(sites); // rebuild map pins

          $scope.deleteMarkers();
          $scope.fitBounds();
        });
        notify.log('Site removed');
      });
    });
  };

  $scope.delAllEmptySites = function () {
    if (!a2UserPermit.can('manage project settings')) {
      notify.error("You do not have permission to remove sites");
      return;
    }

    var list = [],
        siteIds = [];
    $scope.sites.forEach(function (site, index) {
      if (site.rec_count === 0 && !list.includes(site.name)) {
        list.push(site.name);
        siteIds.push(site.id);
      }
    });

    if (!list.length) {
      notify.log("There is no empty site in your project");
      return;
    }

    if (list.length > 3) {
      const msg = '& ' + (list.length - 3) + ' other sites';
      list = list.slice(0, 3);
      list.push(msg);
    }

    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      controller: function () {
        this.messages = ["Are you sure you would like to remove the following sites?"];
        this.list = list;
        this.btnOk = "Delete";
        this.btnCancel = "Cancel";
      },
      controllerAs: 'popup'
    });
    modalInstance.result.then(function () {
      a2Sites.delete(siteIds, function (data) {
        if (data.error) return notify.error(data.error);
        Project.getSites({
          count: true,
          logs: true,
          deployment: true
        }, function (sites) {
          $scope.sortByLastUpdated(sites); // rebuild map pins

          $scope.deleteMarkers();
          $scope.fitBounds();
        });
        notify.log('Empty sites removed');
      });
    });
  };

  $scope.show = {
    map: false,
    status: false
  };
  $scope.show[p.show || 'map'] = true;

  $scope.set_show = function (new_show, show_path) {
    var d = $q.defer(),
        promise = d.promise;
    d.resolve();
    var show_state_param = new_show;

    if (new_show == 'status' && $scope.selected && $scope.selected.has_logs) {
      show_state_param = [new_show].concat(show_path).join(':');
      promise = promise.then(function () {
        return $scope.status_controller.activate($scope.selected, show_path);
      });
    } else {
      promise = promise.then(function () {
        new_show = 'map';
      });
    }

    return promise.then(function () {
      for (var i in $scope.show) {
        $scope.show[i] = false;
      }

      $scope.show[new_show] = true;
      return $state.transitionTo($state.current.name, {
        site: $state.params.site,
        show: show_state_param
      }, {
        notify: false
      });
    });
  };

  $scope.create = function () {
    if (!a2UserPermit.can('manage project sites')) {
      notify.error("You do not have permission to add sites");
      return;
    }

    $scope.temp = {};
    $scope.set_show('map');
    $scope.creating = true; // rebuild map pins

    $scope.deleteMarkers();
    $scope.fitBounds();
  };

  $scope.edit = function () {
    if (!$scope.selected) return;

    if (!a2UserPermit.can('manage project sites')) {
      notify.error("You do not have permission to edit sites");
      return;
    }

    $scope.set_show('map');
    $scope.temp = angular.copy($scope.selected);
    $scope.temp.published = $scope.temp.published === 1;
    Project.getProjectsList('my', function (data) {
      $scope.projects = data.map(function (project) {
        return {
          project_id: project.project_id,
          name: project.name,
          url: project.url
        };
      });
    });
    Project.getInfo(function (data) {
      $scope.temp.project = data;
    });
    $scope.editing = true; // rebuild map pins

    $scope.deleteMarkers();
    $scope.fitBounds();
  };

  $scope.onSelect = function ($item) {
    $scope.temp.project = $item;
  };

  $scope.showAssetsCarousel = false;

  $scope.showCarousel = function (id) {
    $scope.images.forEach(function (image) {
      image.active = image.id === id;
    });
    $scope.showAssetsCarousel = true;
  };

  $scope.capitalizeFirstLetter = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  $scope.sel = function (site) {
    return $state.transitionTo($state.current.name, {
      site: site && site.id,
      show: $state.params.show
    }, {
      notify: false
    }).then(function () {
      $scope.images = [];
      $scope.close();
      $scope.selected = site;

      if ($scope.selected && $scope.selected.external_id) {
        a2Sites.getListOfAssets($scope.selected.external_id).then(function (data) {
          $scope.assets = data;

          if ($scope.assets && $scope.selected.external_id) {
            $scope.assets = $scope.assets.filter(function (asset) {
              return asset.meta !== null;
            });

            for (var i = 0; i < $scope.assets.length; i++) {
              var src = '/legacy-api/project/' + $scope.project.url + '/streams/' + $scope.selected.external_id + '/assets/' + $scope.assets[i].id;
              $scope.images.push({
                id: i,
                src: src,
                active: i === 0,
                label: $scope.assets[i] && $scope.assets[i].meta && $scope.assets[i].meta.label ? $scope.capitalizeFirstLetter($scope.assets[i].meta.label) : 'No label image'
              });
            }
          }

          ;
        }).catch(function (err) {
          console.log('\nerr', err);
        });
      } // rebuild map pins


      $scope.deleteMarkers();
      $scope.fitBounds(); // zoom in to the selected pin

      if ($scope.selected) {
        a2GoogleMapsLoader.then(function (google) {
          var position = new google.maps.LatLng($scope.selected.lat, $scope.selected.lon);
          $scope.map.panTo(position);
          $scope.map.setZoom(12);
        });
      }
    });
  };
}]).controller('ImportSiteInstanceCtrl', ["$scope", "$modalInstance", function ($scope, $modalInstance) {
  $scope.files = [];

  $scope.handler = function (e, files) {
    var reader = new FileReader();

    reader.onload = function (e) {
      $modalInstance.close(reader.result);
    };

    reader.readAsText(files[0]);
  };

  $scope.cancel = function () {
    $modalInstance.dismiss();
  };
}]).controller('SitesTokenGenaratorCtrl', ["$scope", "a2Sites", "$modal", "notify", function ($scope, a2Sites, $modal, notify) {
  $scope.site = $scope.selected;
  $scope.loading = {};

  var confirmRevoke = function (title, btnOk) {
    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      controller: function () {
        this.title = title;
        this.messages = ["This action will revoke the current token for the site <b>" + $scope.site.name + "</b>. " + "Are you sure you want to do this?"];
        this.btnOk = btnOk;
        this.btnCancel = "No";
      },
      controllerAs: 'popup'
    });
    return modalInstance;
  };

  var genToken = function () {
    a2Sites.generateToken($scope.site).success(function (data) {
      $scope.loading.generate = false;
      if (data.error) return notify.error(data.error);
      $scope.site.token_created_on = new Date(data.created * 1000);
      $scope.base64 = data.base64token;
      $scope.token = {
        type: data.type,
        name: data.name,
        created: data.created,
        expires: data.expires,
        token: data.token
      };
      notify.log("New site token generated.");
    }).error(function (data) {
      $scope.loading.generate = false;
      notify.serverError();
    });
  };

  $scope.generateToken = function () {
    $scope.loading.generate = true;

    if ($scope.site.token_created_on) {
      var modalInstance = confirmRevoke("<h4>Confirm revoke and generate token</h4>", "Yes, revoke and generate a new token");
      modalInstance.result.then(function ok() {
        genToken();
      }, function cancel() {
        $scope.loading.generate = false;
      });
    } else {
      genToken();
    }
  };

  $scope.revokeToken = function () {
    var modalInstance = confirmRevoke("<h4>Confirm revoke token</h4>", "Yes, revoke token");
    modalInstance.result.then(function () {
      $scope.loading.revoke = true;
      a2Sites.revokeToken($scope.site).success(function (data) {
        $scope.loading.revoke = false;
        $scope.site.token_created_on = null;
        $scope.token = null;
        notify.log("site token revoked.");
      }).error(function (data) {
        $scope.loading.generate = false;
        notify.serverError();
      });
    });
  };
}]).controller('SiteStatusPlotterController', ["$scope", "$q", "a2Sites", "$debounce", "a2EventEmitter", function ($scope, $q, a2Sites, $debounce, a2EventEmitter) {
  function mk_time_range_fn(from, delta) {
    return function () {
      var fromdt = from == 'now' ? new Date() : new Date(from);
      var todt = new Date(fromdt.getTime() + delta);

      if (delta < 0) {
        var t = fromdt;
        fromdt = todt;
        todt = t;
      }

      return [fromdt, todt];
    };
  }

  function get_by_tag(arr, tag) {
    return arr.filter(function (x) {
      return x.tag == tag;
    }).shift();
  }

  function make_setter(options) {
    var attr = options.data;
    var selattr = options.sel || attr;
    var def = options.def;
    return function set(value, dontRefreshLogs) {
      if (typeof value == 'string') {
        value = get_by_tag(this.data[attr], value);
      }

      if (!value) {
        value = get_by_tag(this.data[attr], def);
      }

      this.selected[selattr] = value;

      if (value.apply) {
        value.apply(this);
      }

      return dontRefreshLogs ? $q.resolve() : this.refresh_logs();
    };
  }

  var events = new a2EventEmitter();
  this.on = events.on.bind(events);
  this.off = events.off.bind(events);

  this.itemGroup = function (item) {
    return item.group;
  };

  this.data = {
    series: [{
      tag: 'status',
      group: 'Site',
      name: 'Battery Status',
      icon: 'fa fa-fw fa-plug',
      axis: {
        y: {
          tick: {
            values: [0, 1, 2, 3],
            format: function (x) {
              return ['unknown', 'charging', 'not charging', 'full'][x | 0];
            }
          }
        }
      }
    }, {
      tag: 'voltage',
      group: 'Site',
      name: 'Voltage',
      icon: 'fa fa-fw fa-bolt'
    }, {
      tag: 'power',
      group: 'Site',
      name: 'Power',
      icon: 'fa fa-fw fa-battery-half'
    }, {
      tag: 'uploads',
      group: 'Data',
      name: 'Uploads',
      icon: 'fa fa-fw fa-upload'
    }, {
      tag: 'recordings',
      group: 'Data',
      name: 'Recordings',
      icon: 'fa fa-fw fa-volume-up'
    }],
    time_ranges: [{
      tag: '1-hour',
      text: 'Last Hour',
      group: 'Hours',
      range: mk_time_range_fn('now', -3600 * 1000)
    }, {
      tag: '3-hour',
      text: 'Last 3 Hours',
      group: 'Hours',
      range: mk_time_range_fn('now', -3 * 3600 * 1000)
    }, {
      tag: '6-hour',
      text: 'Last 6 Hours',
      group: 'Hours',
      range: mk_time_range_fn('now', -6 * 3600 * 1000)
    }, {
      tag: '12-hour',
      text: 'Last 12 Hours',
      group: 'Hours',
      range: mk_time_range_fn('now', -12 * 3600 * 1000)
    }, {
      tag: '24-hour',
      text: 'Last 24 Hours',
      group: 'Hours',
      range: mk_time_range_fn('now', -24 * 3600 * 1000)
    }, {
      tag: '3-days',
      text: 'Last 3 Days',
      group: 'Days',
      range: mk_time_range_fn('now', -3 * 24 * 3600 * 1000)
    }, {
      tag: '1-week',
      text: 'Last Week',
      group: 'Weeks',
      range: mk_time_range_fn('now', -7 * 24 * 3600 * 1000)
    }, {
      tag: '2-weeks',
      text: 'Last 2 Weeks',
      group: 'Weeks',
      range: mk_time_range_fn('now', -14 * 24 * 3600 * 1000)
    }, {
      tag: '1-month',
      text: 'Last Month',
      group: 'Month',
      range: mk_time_range_fn('now', -31 * 24 * 3600 * 1000)
    }],
    periods: [{
      tag: '1-minute',
      text: '1 Minute',
      group: 'Minutes',
      sampling: '1 min',
      granularity: 1 * 60 * 1000
    }, {
      tag: '5-minutes',
      text: '5 Minutes',
      group: 'Minutes',
      sampling: '5 mins',
      granularity: 5 * 60 * 1000
    }, {
      tag: '10-minutes',
      text: '10 Minutes',
      group: 'Minutes',
      sampling: '10 mins',
      granularity: 10 * 60 * 1000
    }, {
      tag: '30-minutes',
      text: '30 Minutes',
      group: 'Minutes',
      sampling: '30 mins',
      granularity: 30 * 60 * 1000
    }, {
      tag: '1-hour',
      text: '1 Hour',
      group: 'Hours',
      sampling: '1 hour',
      granularity: 1 * 60 * 60 * 1000
    }, {
      tag: '3-hours',
      text: '3 Hours',
      group: 'Hours',
      sampling: '3 hours',
      granularity: 3 * 60 * 60 * 1000
    }, {
      tag: '6-hours',
      text: '6 Hours',
      group: 'Hours',
      sampling: '6 hours',
      granularity: 6 * 60 * 60 * 1000
    }, {
      tag: '1-day',
      text: '1 Day',
      group: 'Days',
      sampling: '1 day',
      granularity: 24 * 60 * 60 * 1000
    }] // min_date: 0,
    // max_date: 10000,

  };
  this.loading = {};
  this.selected = {
    series: get_by_tag(this.data.series, 'power'),
    time_range: get_by_tag(this.data.time_ranges, '1-week'),
    period: get_by_tag(this.data.periods, '1-hour')
  };
  this.set_series = make_setter({
    data: 'series',
    sel: 'series',
    def: 'power'
  });
  this.set_time_range = make_setter({
    data: 'time_ranges',
    sel: 'time_range',
    def: '1-week'
  });
  this.set_period = make_setter({
    data: 'periods',
    sel: 'period',
    def: '7-days'
  });

  this.activate = function (selected_site, plot_uri) {
    this.selected.site = selected_site;

    if (plot_uri) {
      if (plot_uri.length) {
        this.set_series(plot_uri.shift());
      }

      if (plot_uri.length) {
        this.set_time_range(plot_uri.shift());
      }

      if (plot_uri.length) {
        this.set_period(plot_uri.shift());
      }
    }

    return this.refresh_logs();
  };

  this.load_data = function (site, series, range, period) {
    var loading = this.loading;
    loading.data = true;
    return a2Sites.getSiteLogData(site.id, series.tag, range[0], range[1], period.sampling).then(function (data) {
      loading.data = false;
      data.x = 'datetime';
      data.axis = series.axis;
      data.empty = {
        label: {
          text: "No data to show."
        }
      };
      return data;
    });
  };

  this.make_chart_struct = function (data) {
    var axes = {
      x: {
        tick: {
          format: function (x) {
            return moment(new Date(x)).utc().format('MM-DD-YYYY HH:mm');
          }
        }
      }
    };

    if (data.axis) {
      angular.merge(axes, data.axis);
      delete data.axis;
    }

    this.chart = {
      data: data,
      axes: axes
    };
  };

  this.refresh_logs = $debounce(function () {
    var d = $q.defer(),
        promise = d.promise;
    d.resolve();
    var site = this.selected.site;
    var series = this.selected.series;
    var time_range = this.selected.time_range;
    var period = this.selected.period;

    if (site && series && time_range && period) {
      var range = time_range.range();
      var granularity = period.granularity;
      promise = d.promise.then(function () {
        if (series.data) {
          if (series.data.site != site || series.data.period != period || !(series.data.range[0] - granularity >= range[0] && range[1] <= series.data.range[1] + granularity)) {
            series.data = null;
          }
        }

        if (!series.data) {
          return this.load_data(site, series, range, period).then(function (data) {
            series.data = {
              data: data,
              site: site,
              range: range,
              period: period
            };
            return series.data.data;
          });
        } else {
          return series.data.data;
        }
      }.bind(this)).then(function (chart_data) {
        console.log("chart_data : ", chart_data);

        if (chart_data) {
          this.make_chart_struct(chart_data);
        }
      }.bind(this)).then(function () {
        events.emit('logs-refreshed', [series.tag, time_range.tag, period.tag]);
      });
    }

    return promise;
  }, 10);
}]);
angular.module('a2.audiodata.soundscape-composition-classes', ['a2.services', 'a2.directives', 'ui.bootstrap', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('audiodata.scAnnotationClasses', {
    url: '/soundscape-annotation-classes',
    controller: 'SoundscapeCompositionClassesScreenCtrl as controller',
    templateUrl: '/app/audiodata/soundscape-composition-classes.html'
  });
}]).controller('SoundscapeCompositionClassesScreenCtrl', ["$modal", "notify", "Project", "a2SoundscapeCompositionService", "a2UserPermit", function ($modal, notify, Project, a2SoundscapeCompositionService, a2UserPermit) {
  this.initialize = function () {
    this.loading = true;
    this.newClass = {};
    this.canManageClasses = a2UserPermit.can("manage project species");
    a2SoundscapeCompositionService.getClassList({
      tally: 1,
      groupByType: true,
      isSystemClass: 1
    }).then(function (classes) {
      this.classes = classes;
      this.loading = false;
    }.bind(this));
  };

  this.addNewClass = function (groupType) {
    var className = this.newClass[groupType.typeId];
    delete this.newClass[groupType.typeId];

    if (className) {
      if (!a2UserPermit.can("manage project species")) {
        notify.error("You do not have permission to add soundscape composition classes");
        return;
      }

      a2SoundscapeCompositionService.addClass(className, groupType.typeId).then(function (newClass) {
        groupType.list.push(newClass);
      }.bind(this)).catch(function (err) {
        notify.error(err.data || err.message);
      });
    }
  };

  this.removeClass = function (scClass) {
    if (scClass.isSystemClass) {
      return;
    }

    if (!a2UserPermit.can("manage project species")) {
      notify.error("You do not have permission to remove soundscape composition classes");
      return;
    }

    a2SoundscapeCompositionService.removeClass(scClass.id).then(function () {
      this.classes.forEach(function (classGroup) {
        var index = classGroup.list.indexOf(scClass);

        if (index >= 0) {
          classGroup.list.splice(index, 1);
        }
      });
    }.bind(this)).catch(function (err) {
      notify.error(err.data || err.message);
    });
  };

  this.add = function () {
    if (!a2UserPermit.can("manage project species")) {
      notify.error("You do not have permission to add species");
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/audiodata/select-species.html',
      controller: 'SelectSoundscapeCompositionClassesScreenCtrl',
      size: 'lg'
    });
    modalInstance.result.then(function (selected) {
      var cls = {
        species: selected.species.scientific_name,
        songtype: selected.song.name
      };
      Project.addClass(cls).success(function (result) {
        notify.log(selected.species.scientific_name + ' ' + selected.song.name + " added to project");
        Project.getClasses(function (classes) {
          this.classes = classes;
        });
      }).error(function (data, status) {
        if (status < 500) notify.error(data.error);else notify.serverError();
      });
    });
  };

  this.del = function () {
    if (!this.checked || !this.checked.length) return;

    if (!a2UserPermit.can("manage project species")) {
      notify.error("You do not have permission to remove species");
      return;
    }

    var speciesClasses = this.checked.map(function (row) {
      return '"' + row.species_name + ' | ' + row.songtype_name + '"';
    });
    var message = ["You are about to delete the following project species: "];
    var message2 = ["Are you sure?"];
    this.popup = {
      messages: message.concat(speciesClasses, message2),
      btnOk: "Yes, do it!",
      btnCancel: "No"
    };
    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      scope: this
    });
    modalInstance.result.then(function () {
      var classesIds = this.checked.map(function (row) {
        return row.id;
      });
      var params = {
        project_classes: classesIds
      };
      Project.removeClasses(params).success(function (result) {
        Project.getClasses(function (classes) {
          this.classes = classes;
        });
      }).error(function (data, status) {
        if (status < 500) notify.error(data.error);else notify.serverError();
      });
    });
  };

  this.initialize();
}]);
angular.module('a2.audiodata.species', ['a2.services', 'a2.directives', 'ui.bootstrap', 'humane']).controller('SpeciesCtrl', ["$scope", "Project", "$modal", "notify", "a2UserPermit", function ($scope, Project, $modal, notify, a2UserPermit) {
  $scope.loading = true;
  $scope.selected = {};
  Project.getClasses(function (classes) {
    $scope.classes = classes;
    $scope.loading = false;
  });
  Project.getInfo(function (info) {
    $scope.project = info;
  });

  $scope.add = function () {
    if (!a2UserPermit.can("manage project species")) {
      notify.error("You do not have permission to add species");
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/audiodata/select-species.html',
      controller: 'SelectSpeciesCtrl',
      size: 'lg'
    });
    modalInstance.result.then(function (selected) {
      var cls = {
        species: selected.species.scientific_name,
        songtype: selected.song.name
      };
      Project.addClass(cls).success(function (result) {
        notify.log(selected.species.scientific_name + ' ' + selected.song.name + " added to project");
        Project.getClasses(function (classes) {
          $scope.classes = classes;
        });
      }).error(function (data, status) {
        if (status < 500) notify.error(data.error);else notify.serverError();
      });
    });
  };

  $scope.del = function () {
    if (!$scope.checked || !$scope.checked.length) return;

    if (!a2UserPermit.can("manage project species")) {
      notify.error("You do not have permission to remove species");
      return;
    }

    var speciesClasses = $scope.checked.map(function (row) {
      return '"' + row.species_name + ' | ' + row.songtype_name + '"';
    });
    var message = ["Are you sure you would like to remove the following species call from this project?"];
    var message2 = ["Note: validations for this species call will also be removed from this project."];
    $scope.popup = {
      messages: message.concat(message2, speciesClasses),
      btnOk: "Yes, do it!",
      btnCancel: "No"
    };
    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      scope: $scope
    });
    modalInstance.result.then(function () {
      var classesIds = $scope.checked.map(function (row) {
        return row.id;
      });
      var params = {
        project_classes: classesIds
      };
      Project.removeClasses(params).success(function (result) {
        Project.getClasses(function (classes) {
          $scope.classes = classes;
        });
      }).error(function (data, status) {
        if (status < 500) notify.error(data.error);else notify.serverError();
      });
    });
  };
}]).controller('SelectSpeciesCtrl', ["$scope", "Species", "Songtypes", function ($scope, Species, Songtypes) {
  var timeout;
  Songtypes.get(function (songs) {
    $scope.songtypes = songs;
  });

  $scope.searchSpecies = function () {
    if ($scope.search === "") {
      $scope.species = [];
      return;
    }

    clearTimeout(timeout);
    timeout = setTimeout(function () {
      Species.search($scope.search, function (results) {
        $scope.species = results;
      });
    }, 500);
  };
}]);
angular.module('a2.audiodata.training-sets', ['a2.services', 'a2.directives', 'ui.bootstrap', 'a2.visualizer.layers.training-sets', 'humane']).factory('a2TrainingSetHistory', function () {
  var lastSet, lastPage, lastRoi, lastRoiSet, viewState, lastSpecie, lastSongtype;
  return {
    getLastSet: function (callback) {
      callback({
        ls: lastSet,
        lp: lastPage,
        lr: lastRoi,
        lrs: lastRoiSet,
        vs: viewState,
        sp: lastSpecie,
        sg: lastSongtype
      });
    },
    setLastSet: function (val) {
      lastSet = val;
    },
    setLastPage: function (val) {
      lastPage = val;
    },
    setLastRoi: function (val) {
      lastRoi = val;
    },
    setLastRoiSet: function (val) {
      lastRoiSet = val;
    },
    setViewState: function (val) {
      viewState = val;
    },
    setLastSpecies: function (valsp, valsg) {
      lastSpecie = valsp;
      lastSongtype = valsg;
    }
  };
}).controller('TrainingSetsCtrl', ["$state", "a2TrainingSets", "Project", "$q", "$modal", "a2TrainingSetHistory", "a2UserPermit", "notify", function ($state, a2TrainingSets, Project, $q, $modal, a2TrainingSetHistory, a2UserPermit, notify) {
  var p = {
    set: $state.params.set,
    show: $state.params.show
  };
  this.selected = {
    roi_index: 0,
    roi: null,
    page: 0
  };
  this.total = {
    rois: 0,
    pages: 0
  };
  this.loading = {
    list: false,
    details: false
  };
  this.rois = [];
  this.species = '';
  this.songtype = '';
  this.detailedView = p.show != "gallery";
  this.currentrois = [];
  this.roisPerpage = 100;
  this.detailedView = false;
  this.loaderDisplay = false;

  this.getROIVisualizerUrl = function (roi) {
    return roi ? "/project/" + this.projecturl + "/#/visualizer/rec/" + roi.recording : '';
  };

  this.setROI = function (roi_index) {
    if (this.total.rois <= 0) {
      this.selected.roi_index = 0;
      this.selected.roi = null;
    } else {
      this.selected.roi_index = Math.max(0, Math.min(roi_index | 0, this.total.rois - 1));
      this.selected.roi = this.rois[this.selected.roi_index];
    }

    a2TrainingSetHistory.setLastRoi(this.selected.roi);
    return this.selected.roi;
  };

  this.setPage = function (page) {
    if (this.total.rois <= 0) {
      this.selected.page = 0;
      this.selected.currentrois = [];
    } else {
      this.selected.page = Math.max(0, Math.min(page, this.total.rois / this.roisPerpage | 0));
      this.currentrois = this.rois.slice(this.selected.page * this.roisPerpage, (this.selected.page + 1) * this.roisPerpage);
    }

    a2TrainingSetHistory.setLastPage(this.selected.page);
    return this.currentrois;
  };

  this.setROISet = function (rois) {
    this.rois = rois;
    a2TrainingSetHistory.setLastRoiSet(this.rois);
  };

  this.nextROI = function (step) {
    return this.setROI(this.selected.roi_index + (step || 1));
  };

  this.prevROI = function (step) {
    return this.setROI(this.selected.roi_index - (step || 1));
  };

  this.nextPage = function (step) {
    return this.setPage(this.selected.page + (step || 1));
  };

  this.prevPage = function (step) {
    return this.setPage(this.selected.page - (step || 1));
  };

  this.next = function (step) {
    if (!step) {
      step = 1;
    }

    if (this.detailedView) {
      this.nextROI(step);
    } else {
      this.nextPage(step);
    }
  };

  this.prev = function (step) {
    if (!step) {
      step = 1;
    }

    return this.next(-step);
  };

  this.removeRoi = function (roiId) {
    if (!a2UserPermit.can('manage training sets')) {
      notify.error('You do not have permission to edit training sets');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      controller: function () {
        this.messages = ["You are about to delete a ROI. Are you sure?"];
        this.btnOk = "Yes, do it!";
        this.btnCancel = "No";
      },
      controllerAs: 'popup'
    });
    modalInstance.result.then(function () {
      a2TrainingSets.removeRoi(this.selected.trainingSet.id, roiId, function (data) {
        if (data.affectedRows) {
          for (var i = 0; i < this.rois.length; i++) {
            if (this.rois[i].id == roiId) {
              this.rois.splice(i, 1);
              break;
            }
          }

          this.total.rois = this.rois.length;
          this.setROI(this.selected.roi_index);
          this.setPage(this.selected.page);
        }
      }.bind(this));
    }.bind(this));
  };

  this.closeSetDetails = function () {
    this.showSetDetails = false;
  };

  this.getTrainingSetList = function () {
    this.loading.list = true;
    return a2TrainingSets.getList(function (data) {
      this.trainingSets = data.map(function (d) {
        d.date_created = new Date(d.date_created);
        return d;
      });

      if (p.set) {
        var selected = this.trainingSets.filter(function (tset) {
          return tset.id == p.set;
        }).pop();

        if (selected) {
          this.selectTrainingSet(selected);
        }
      }

      this.loading.list = false;
    }.bind(this));
  };

  this.addNewTrainingSet = function () {
    if (!a2UserPermit.can('manage training sets')) {
      notify.error('You do not have permission to create training sets');
      return;
    }

    $modal.open({
      templateUrl: '/app/visualizer/layers/training-data/add_tset_modal.html',
      controller: 'a2VisualizerAddTrainingSetModalController'
    }).result.then(this.getTrainingSetList.bind(this));
  };

  this.selectTrainingSet = function (selected) {
    $state.transitionTo($state.current.name, {
      set: selected.id,
      show: $state.params.show
    }, {
      notify: false
    });
    this.detailedView = $state.params.show != "gallery";
    this.loaderDisplay = true;
    a2TrainingSetHistory.setLastSet(selected);

    if (this.selected.trainingSet) {
      if (this.selected.trainingSet.edit) {
        delete this.selected.trainingSet.edit;
      }
    }

    this.selected.trainingSet = selected;
    Project.validationBySpeciesSong(selected.species, selected.songtype, function (data) {
      this.selected.trainingSet.validations = data;
    }.bind(this));
    a2TrainingSets.getSpecies(selected.id, function (speciesData) {
      this.species = speciesData.species;
      this.songtype = speciesData.songtype;
      a2TrainingSetHistory.setLastSpecies(this.species, this.songtype);
      a2TrainingSets.getRois(selected.id, function (data) {
        this.loaderDisplay = false;
        this.detailedView = false;
        this.total.rois = data.length;
        this.total.pages = Math.ceil(this.total.rois / this.roisPerpage);
        this.setROISet(data);
        this.setROI(0);
        this.setPage(0);
        this.selected.page = 0;
      }.bind(this));
    }.bind(this));
  };

  this.setupExportUrl = function () {
    this.selected.trainingSet.export_url = a2TrainingSets.getExportUrl(this.selected.trainingSet.id);
  };

  this.exportTSReport = function ($event) {
    $event.stopPropagation();
    if (a2UserPermit.isSuper()) return this.setupExportUrl();

    if (a2UserPermit.all && !a2UserPermit.all.length || !a2UserPermit.can('export report')) {
      return notify.error('You do not have permission to export Training Set data');
    } else return this.setupExportUrl();
  };

  this.setDetailedView = function (detailedView) {
    $state.transitionTo($state.current.name, {
      set: $state.params.set,
      show: detailedView ? "detail" : "gallery"
    }, {
      notify: false
    });
    this.detailedView = detailedView;
    a2TrainingSetHistory.setViewState(this.detailedView);
  };

  this.editSelectedTrainingSet = function () {
    if (!a2UserPermit.can('manage training sets')) {
      notify.error('You do not have permission to edit training sets');
      return;
    }

    if (this.selected.trainingSet) {
      var trainingSet = this.selected.trainingSet;
      var speciesClass = {
        species: trainingSet.species,
        songtype: trainingSet.songtype
      };
      speciesClass.species_name = this.species;
      speciesClass.songtype_name = this.songtype;
      Project.getClasses().then(function (classes) {
        var d = $q.defer();
        var current = classes.filter(function (cls) {
          return speciesClass.species == cls.species && speciesClass.songtype == cls.songtype;
        }).pop() || speciesClass;
        trainingSet.edit = {
          name: trainingSet.name,
          class: current,
          projectClasses: classes
        };
        trainingSet.edit.cancel = d.reject.bind(d);

        trainingSet.edit.save = function () {
          return a2TrainingSets.edit(trainingSet.id, {
            name: trainingSet.edit.name,
            class: trainingSet.edit.class.id
          }).then(function (response) {
            d.resolve(response.data);
          }, function (response) {
            notify.log(response.data);
          });
        };

        return d.promise;
      }).then(function (editedTrainingSet) {
        for (var i in editedTrainingSet) {
          trainingSet[i] = editedTrainingSet[i];
        }

        this.selectTrainingSet(trainingSet);
      }.bind(this)).finally(function () {
        delete trainingSet.edit;
      });
    }
  };

  this.deleteSelectedTrainingSet = function () {
    var trainingSet = this.selected.trainingSet;

    if (!trainingSet) {
      return;
    }

    if (!a2UserPermit.can('manage training sets')) {
      notify.error('You do not have permission to edit training sets');
      return;
    }

    $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      controller: function () {
        this.messages = ["You are about to delete a the training set \"" + trainingSet.name + "\". Are you sure?"];
        this.btnOk = "Yes, do it!";
        this.btnCancel = "No";
      },
      controllerAs: 'popup'
    }).result.then(function () {
      a2TrainingSets.delete(trainingSet.id, function (data) {
        this.trainingSets.splice(this.trainingSets.indexOf(trainingSet), 1);
        delete this.selected.trainingSet;
      }.bind(this));
    }.bind(this));
  };

  this.getTrainingSetList();
  this.projecturl = Project.getUrl();
  a2TrainingSetHistory.getLastSet(function (data) {
    if (data.ls) {
      this.showSetDetails = true;
      this.selected.trainingSet = data.ls;
      this.species = data.sp;
      this.songtype = data.sg;
      this.detailedView = data.vs;
      this.total.rois = data.lrs.length;
      this.total.pages = Math.ceil(this.total.rois / this.roisPerpage);
      this.selected.page = data.lp;
      this.setROISet(data.lrs);
      this.setPage(data.lp);
      this.setROI(data.lr || 0);
    }
  }.bind(this));
}]);
angular.module('a2.citizen-scientist', ['a2.citizen-scientist.my-stats', 'a2.directive.audio-bar', 'a2.citizen-scientist.patternmatching', 'a2.citizen-scientist.expert', 'a2.citizen-scientist.admin', 'ui.router', 'ct.ui.router.extras']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.when("/citizen-scientist", "/citizen-scientist/patternmatching/");
  $stateProvider.state('citizen-scientist', {
    url: '/citizen-scientist',
    views: {
      'citizen-scientist': {
        templateUrl: '/app/citizen-scientist/index.html'
      }
    },
    deepStateRedirect: true,
    sticky: true
  });
}]);
angular.module('a2.app.dashboard', ['a2.services', 'a2.directives', 'ui.bootstrap', 'ui.router', 'ct.ui.router.extras', 'a2.forms', 'humane', 'a2.googlemaps', 'a2.directive.warning-banner']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('dashboard', {
    url: '/dashboard',
    controller: 'SummaryCtrl',
    templateUrl: '/app/dashboard/index.html'
  });
}]).controller('SummaryCtrl', ["$scope", "Project", "a2Templates", "a2GoogleMapsLoader", "$timeout", "$window", "$compile", "$templateFetch", "a2PatternMatching", function ($scope, Project, a2Templates, a2GoogleMapsLoader, $timeout, $window, $compile, $templateFetch, a2PatternMatching) {
  $scope.loading = 5;

  var done = function () {
    if ($scope.loading > 0) --$scope.loading;
  };

  Project.getInfo(function (info) {
    $scope.project = info;
    $scope.isSpeciesLoading = true;
    Project.getProjectTotalSpecies(info.project_id, function (data) {
      $scope.speciesQty = data || 0;
      $scope.isSpeciesLoading = false;
    });
    done();
  });
  Project.getSites(function (sites) {
    $scope.sites = sites;
    done();
    $timeout(function () {
      a2GoogleMapsLoader.then(function (google) {
        $scope.map = new google.maps.Map($window.document.getElementById('summary-map'), {
          center: {
            lat: 0,
            lng: 0
          },
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          zoom: 8,
          minZoom: 2
        });
        var bounds = new google.maps.LatLngBounds();
        angular.forEach($scope.sites, function (site) {
          if (site.lat > 85 || site.lat < -85 || site.lon > 180 || site.lon < -180) {
            return;
          }

          var position = new google.maps.LatLng(site.lat, site.lon);
          var marker = new google.maps.Marker({
            position: position,
            title: site.name
          });
          bounds.extend(position);
          marker.setMap($scope.map);
          $scope.map.fitBounds(bounds);
        });
      });
    }, 100);
  });
  Project.getRecTotalQty(function (data) {
    $scope.recsQty = data;
    done();
  });
  a2Templates.getList().then(function (data) {
    $scope.templateQty = data.length;
    done();
  });
  a2PatternMatching.getPatternMatchingsTotal(function (data) {
    $scope.pmQty = data;
    done();
  });
}]);
angular.module('a2.jobs', ['a2.services', 'a2.permissions']).config(["$stateProvider", function ($stateProvider) {
  $stateProvider.state('jobs', {
    url: '/jobs',
    controller: 'StatusBarNavController',
    templateUrl: '/app/jobs/index.html'
  });
}]).controller('StatusBarNavController', ["$scope", "$http", "$modal", "$window", "Project", "JobsData", "notify", "a2UserPermit", function ($scope, $http, $modal, $window, Project, JobsData, notify, a2UserPermit) {
  $scope.show = {};
  $scope.showClassifications = true;
  $scope.showTrainings = true;
  $scope.showSoundscapes = true;
  $scope.url = '';
  $scope.successInfo = "";
  $scope.showSuccesss = false;
  $scope.errorInfo = "";
  $scope.showErrors = false;
  $scope.infoInfo = "Loading...";
  $scope.showInfo = true;
  $scope.loading = {
    jobs: false
  };
  $scope.loading.jobs = true;

  $scope.updateFlags = function () {
    $scope.successInfo = "";
    $scope.showSuccess = false;
    $scope.errorInfo = "";
    $scope.showError = false;
    $scope.infoInfo = "";
    $scope.showInfo = false;
  };

  Project.getInfo(function (info) {
    $scope.project = info;
  });

  var hideJob = function (jobId, action) {
    $http.get('/legacy-api/project/' + Project.getUrl() + '/jobs/hide/' + jobId).success(function (data) {
      JobsData.updateJobs();
      const message = 'Job ' + action + ' successfully.';
      notify.log(message);
    }).error(function (data) {
      if (data.error) {
        notify.error(error);
      } else {
        notify.serverError();
      }
    });
  };

  JobsData.getJobTypes().success(function (data) {
    var colors = ['#1482f8', '#df3627', '#40af3b', '#9f51bf', '#d37528', '#ffff00', '#5bc0de'];
    var job_types_id = [1, 2, 4, 6, 7, 8, 9];
    var job_types = data.filter(function (type) {
      return job_types_id.includes(type.id);
    });
    $scope.job_types = {};
    $scope.job_types.types = job_types;
    $scope.job_types.show = {};
    $scope.job_types.for = {};
    $scope.job_types.types.forEach(function (c, i) {
      $scope.show[c.id] = true;
      $scope.job_types.for[c.id] = c;
      c.color = colors[i % colors.length];
    });
  });
  $scope.$watch(function () {
    return JobsData.getJobs();
  }, function (new_jobs) {
    $scope.jobs = new_jobs;
    $scope.loading.jobs = false;
    JobsData.startTimer();
    $scope.infoInfo = "";
    $scope.showInfo = false;
  }, true);
  $scope.$on('$destroy', function () {
    JobsData.cancelTimer();
  });

  $scope.showActiveJobs = function () {
    return !$scope.loading.jobs && $scope.jobs !== undefined && $scope.jobs.length;
  };

  $scope.showEmptyList = function () {
    return !$scope.loading.jobs && $scope.jobs !== undefined && !$scope.jobs.length;
  };

  $scope.showLoader = function () {
    return $scope.jobs === undefined;
  };

  var confirm = function (titlen, action, cb, vl, message) {
    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      controller: function () {
        this.title = titlen + ' running job';
        this.messages = ["This job has not finished yet. Are you sure?"];
        this.btnOk = "Yes, " + action + " it";
        this.btnCancel = "No";
      },
      controllerAs: "popup"
    });
    modalInstance.opened.then(function () {
      $scope.infoInfo = "";
      $scope.showInfo = false;
    });
    modalInstance.result.then(function (ok) {
      cb(vl, message);
    });
  };

  $scope.hide = function (job) {
    if (!a2UserPermit.can('manage project jobs')) {
      notify.error('You do not have permission to hide or cancel jobs');
      return;
    }

    const jobId = job.job_id;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;

    if (job.percentage < 100) {
      confirm('Cancel', 'cancel', hideJob, jobId, 'canceled');
    } else {
      hideJob(jobId, 'hidden');
    }
  };

  $scope.isCompleted = function (row) {
    return row.state === 'completed';
  };

  $scope.isProcessing = function (row) {
    return row.state === 'processing';
  };

  $scope.isWaiting = function (row) {
    return row.state === 'waiting';
  };

  $scope.openJob = function (row) {
    $window.location.href = '/project/' + Project.getUrl() + '/analysis/' + row.url;
  };
}]).service('JobsData', ["$http", "$interval", "Project", "$q", function ($http, $interval, Project, $q) {
  var jobs;
  var url = Project.getUrl();
  var intervalPromise;
  var isProcessing = false;

  updateJobs = function () {
    if (isProcessing) return;
    isProcessing = true;
    $http.get('/legacy-api/project/' + url + '/jobs/progress', {
      params: {
        last3Months: true
      }
    }).success(function (data) {
      data.forEach(function (item) {
        if (item.job_type_id === 1 && item.completed === 0 && item.state === 'error') {
          item.state = 'error: insufficient validations';
        }

        if (item.job_type_id === 2 && item.completed === 0 && item.state === 'completed') {
          item.state = 'processing';
        }
      });
      jobs = data;
      isProcessing = false;
    });
  };

  updateJobs();
  return {
    geturl: function () {
      return url;
    },
    getJobs: function () {
      return jobs;
    },
    getJobTypes: function () {
      return $http.get('/legacy-api/jobs/types');
    },
    updateJobs: function () {
      return updateJobs();
    },
    startTimer: function () {
      $interval.cancel(intervalPromise);

      if (typeof jobs != 'undefined' && jobs.length > 0) {
        intervalPromise = $interval(function () {
          var cancelInterval = true;

          for (var i = 0; i < jobs.length; i++) {
            if (jobs[i].percentage < 100) {
              cancelInterval = false;
              break;
            }
          }

          if (cancelInterval) {
            $interval.cancel(intervalPromise);
          } else if (jobs.length < 1) {
            $interval.cancel(intervalPromise);
          } else {
            updateJobs();
          }
        }, 10000);
      }
    },
    cancelTimer: function () {
      $interval.cancel(intervalPromise);
    }
  };
}]);
angular.module('a2.settings', ['a2.services', 'a2.directives', 'a2.forms', 'a2.orders', 'a2.permissions', 'a2.directive.sidenav-bar', 'ui.bootstrap', 'ui.router', 'ct.ui.router.extras', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.when("/settings", "/settings/details");

  var accessCheck = function (a2UserPermit) {
    return a2UserPermit.can("manage project settings");
  };

  $stateProvider.state('settings', {
    url: '/settings',
    templateUrl: '/app/settings/index.html',
    allowAccess: accessCheck
  }).state('settings.details', {
    url: '/details',
    controller: 'SettingsDetailsCtrl',
    templateUrl: '/app/settings/details.html',
    allowAccess: accessCheck
  }).state('settings.users', {
    url: '/users',
    controller: 'SettingsUsersCtrl',
    templateUrl: '/app/settings/users.html',
    allowAccess: accessCheck
  });
}]).controller('SettingsDetailsCtrl', ["$scope", "Project", "notify", "$window", "$timeout", "a2order", "a2UserPermit", "$modal", function ($scope, Project, notify, $window, $timeout, a2order, a2UserPermit, $modal) {
  $scope.today = new Date();
  Project.getInfo(function (info) {
    if (info.plan_activated && info.plan_period) {
      info.plan_due = new Date(info.plan_activated);
      info.plan_due.setFullYear(info.plan_due.getFullYear() + info.plan_period);
    }

    $scope.project = info;
  });
  Project.getUsage().success(function (usage) {
    $scope.minUsage = usage.min_usage;
  });

  $scope.save = function () {
    console.log($scope);
    if (!$scope.isValid) return;

    if (!$scope.project.description) {
      $scope.project.description = '';
    }

    Project.updateInfo({
      project: $scope.project
    }, function (err, result) {
      if (err) {
        return notify.serverError();
      }

      if (result.error) {
        return notify.error(result.error);
      }

      notify.log('Project info updated');

      if (result.url) {
        $timeout(function () {
          $window.location.assign('/project/' + result.url + '/#/settings');
        }, 1000);
      }
    });
  };

  $scope.deleteProject = function () {
    if (!a2UserPermit.can('delete project')) {
      notify.error('You do not have permission to delete this project');
      return;
    }

    $scope.popup = {
      title: 'Delete project',
      messages: ['Are you sure you want to delete this project?'],
      btnOk: 'Yes',
      btnCancel: 'No'
    };
    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      scope: $scope
    });
    modalInstance.result.then(function () {
      return Project.removeProject({
        external_id: $scope.project.external_id
      }).then(function () {
        notify.log('Project deleted');
        $window.location.href = '/projects';
      });
    });
  };

  $scope.changePlan = function () {
    var modalInstance = a2order.changePlan({});
  };
}]).controller('SettingsUsersCtrl', ["$scope", "$http", "Project", "$modal", "notify", function ($scope, $http, Project, $modal, notify) {
  $scope.userToAdd = '';
  $scope.curQuery = '';
  Project.getInfo(function (info) {
    $scope.project = info;
  });
  Project.getUsers(function (err, users) {
    $scope.users = users;
  });
  Project.getRoles(function (err, roles) {
    $scope.roles = roles;
  });

  $scope.findUser = function (query) {
    $scope.curQuery = query;
    return $http.get('/legacy-api/user/search/' + query).then(function (response) {
      return response.data;
    });
  };

  $scope.inviteUser = function (data) {
    return $http.post('/legacy-api/user/invite', data).then(function (response) {
      return response.data;
    });
  };

  $scope.add = function () {
    if (!$scope.userToAdd) {
      return;
    }

    Project.addUser({
      project_id: $scope.project.project_id,
      user_id: $scope.userToAdd.id,
      user_email: $scope.userToAdd.email
    }, function (err) {
      if (err) {
        notify.error(err);
      } else {
        $scope.curQuery = '';
        notify.log('User added to project');
      }

      Project.getUsers(function (err, users) {
        $scope.users = users;
      });
    });
  };

  $scope.invite = function () {
    $scope.showInvitationPopup($scope.curQuery);
  };

  $scope.showInvitationPopup = function (email) {
    var modalInstance = $modal.open({
      templateUrl: '/app/settings/invitation.html',
      controller: 'UserInvitationCtrl as controller',
      resolve: {
        email: function () {
          return email;
        },
        inviteUser: function () {
          return $scope.inviteUser;
        }
      }
    });
    modalInstance.result.then(function (user) {
      $scope.noResults = false;
      $scope.userToAdd = user;
      $scope.userToAdd.id = user.user_id;
      $scope.add();
    });
  };

  $scope.changeRole = function ($index) {
    var role = $scope.roles.filter(function (value) {
      return $scope.users[$index].rolename === value.name;
    })[0];
    Project.changeUserRole({
      project_id: $scope.project.project_id,
      user_id: $scope.users[$index].id,
      user_email: $scope.users[$index].email,
      role_id: role.id
    }, function (err) {
      if (err) {
        notify.error(err);
      } else {
        notify.log('User role updated');
      }

      Project.getUsers(function (err, users) {
        $scope.users = users;
      });
    });
  };

  const message = ['Are you sure you would like to remove the following user from this project?'];

  $scope.del = function ($index) {
    const user = $scope.users[$index];
    $scope.popup = {
      messages: message.concat(user.firstname + ' ' + user.lastname + ' ' + '(' + user.email + ')'),
      btnOk: "Yes, do it!",
      btnCancel: "No"
    };
    var modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      scope: $scope
    });
    modalInstance.result.then(function () {
      Project.removeUser({
        project_id: $scope.project.project_id,
        user_id: $scope.users[$index].id,
        user_email: $scope.users[$index].email
      }, function (err) {
        if (err) {
          notify.error(err);
        } else {
          notify.log('User deleted from project');
        }

        Project.getUsers(function (err, users) {
          $scope.users = users;
        });
      });
    });
  };
}]).controller('UserInvitationCtrl', ["$modalInstance", "notify", "email", "inviteUser", function ($modalInstance, notify, email, inviteUser) {
  Object.assign(this, {
    initialize: function () {
      this.isLoading = false;
      this.data = {
        email: email,
        firstname: '',
        lastname: ''
      };
    },
    submit: function () {
      var _this = this;

      try {
        this.isLoading = true;
        return inviteUser(this.data).then(function (user) {
          $modalInstance.close(user);
        }).catch(notify.serverError).finally(function () {
          _this.isLoading = false;
        });
      } catch (error) {
        console.error('UserInvitationCtrl.submit error: ', error);
      }
    },
    cancel: function () {
      $modalInstance.close(null);
    },
    isDataValid: function () {
      return this.data.email.trim().length > 0 && this.data.firstname.trim().length > 0 && this.data.lastname.trim().length > 0;
    }
  });
  this.initialize();
}]);
angular.module('a2.visualizer.audio-player', []).service('a2AudioPlayer', ["A2AudioObject", "$q", "notify", "a2Playlists", "Project", "$localStorage", "a2UserPermit", function (A2AudioObject, $q, notify, a2Playlists, Project, $localStorage, a2UserPermit) {
  'use strict';

  var a2AudioPlayer = function (scope, options) {
    this.scope = scope;
    this.gain = 1;
    this.gain_levels = [1, 2, 5, 10, 15, 20, 25, 30, 50];
    this.freq_filter = undefined;
    this.is_playing = false;
    this.is_muted = false;
    this.has_recording = false;
    this.has_next_recording = false;
    this.has_prev_recording = false;
    this.resource = null;
    this.resource_params = {};
    this.isPopupOpened = false;
    this.isSavingPlaylist = false;
    this.playlistData = {};
    this.clustersData = null;

    if (options) {
      if (options.gain) {
        this.gain = Math.min(Math.max(1, (options && options.gain) | 0), this.gain_levels[this.gain_levels.length - 1]);
        this.resource_params.gain = this.gain;
      }

      if (options.filter) {
        var f = options.filter.split('-');
        var f0 = f.shift() | 0,
            f1 = f.shift() | 0;
        var fmin = Math.min(f0, f1),
            fmax = Math.max(f0, f1);

        if (fmax) {
          this.freq_filter = {
            min: fmin,
            max: fmax
          };
          this.resource_params.maxFreq = fmax;
          this.resource_params.minFreq = fmin;
        }
      }
    }

    scope.$on('$destroy', this.discard.bind(this));
  };

  a2AudioPlayer.prototype = {
    setFrequencyFilter: function (freq_filter) {
      if (freq_filter) {
        this.resource_params.maxFreq = freq_filter.max;
        this.resource_params.minFreq = freq_filter.min;
      } else {
        delete this.resource_params.maxFreq;
        delete this.resource_params.minFreq;
      }

      return this.load(this.resource_url).then(function () {
        this.freq_filter = freq_filter;
      }.bind(this)); // this.resource.setFrequencyFilter(filter).then((function(){
      //     this.freq_filter = filter;
      // }).bind(this));
    },
    setGain: function (gain) {
      gain = Math.max(1, gain | 0);

      if (gain != 1) {
        this.resource_params.gain = gain;
      } else {
        delete this.resource_params.gain;
      }

      return (this.resource_url ? this.load(this.resource_url) : $q.resolve()).then(function () {
        this.gain = gain;
      }.bind(this)); // this.resource.setGain(gain).then((function(){
      //     this.gain = gain;
      // }).bind(this));
    },
    getVolume: function () {
      return this.resource && this.resource.audio.volume;
    },
    setCurrentTime: function (time) {
      if (this.resource) {
        this.resource.setCurrentTime(time);
      }
    },
    getCurrentTime: function () {
      return this.resource && this.resource.audio && this.resource.audio.currentTime;
    },
    togglePopup: function () {
      this.isPopupOpened = !this.isPopupOpened;
    },
    isPlaylistDataValid: function () {
      return this.playlistData.playlistName && this.playlistData.playlistName.trim().length > 0;
    },
    closePopup: function () {
      this.isPopupOpened = false;
    },
    savePlaylist: function () {
      this.isSavingPlaylist = true; // create playlist

      if (this.clustersData && this.clustersData.playlist) {
        var self = this;
        a2Playlists.create({
          playlist_name: this.playlistData.playlistName,
          params: this.clustersData.playlist.recordings,
          aedIdsIncluded: true
        }, function (data) {
          self.isSavingPlaylist = false;
          self.closePopup(); // attach aed to playlist

          if (data && data.playlist_id) {
            a2Playlists.attachAedToPlaylist({
              playlist_id: data.playlist_id,
              aed: self.clustersData.aed
            }, function (data) {
              self.playlistData = {};
              notify.log('Audio event detections are saved in the playlist.');
            });
          }
        });
      }
    },
    _load_resource: function (url, params) {
      this.loading = true;

      if (params) {
        var pk = Object.keys(params);

        if (pk.length) {
          var ch = /\?/.test(url) ? '&' : '?';
          url += ch + pk.map(function (k) {
            return k + '=' + params[k];
          }).join('&');
        }
      }

      var resource = new A2AudioObject(url);
      resource.onCompleteListeners.push(function () {
        this.is_playing = false;
      }.bind(this));
      return resource.load_promise.then(function () {
        this.loading = false;
      }.bind(this)).then(function () {
        return resource;
      });
    },
    load: function (url) {
      this.discard();
      this.resource = undefined;
      return this._load_resource(url, this.resource_params).then(function (resource) {
        this.resource = resource;
        this.duration = resource.duration;
        this.resource_url = url;
        this.has_recording = true;
        this.clustersData = JSON.parse($localStorage.getItem('analysis.clusters'));
        console.log('clustersData', this.clustersData);
      }.bind(this));
    },
    discard: function () {
      this.stop();

      if (this.resource) {
        this.resource.discard();
      }

      this.has_recording = false;
      this.resource = undefined;
      this.resource_url = undefined;
    },
    mute: function (muted) {
      if (this.resource) {
        this.resource[muted ? 'mute' : 'unmute']();
      }

      this.is_muted = muted;
    },
    play: function () {
      if (this.resource) {
        this.resource.play();
        this.is_playing = true;
      }
    },
    pause: function () {
      if (this.resource) {
        this.resource.pause();
      }

      this.is_playing = false;
    },
    stop: function () {
      if (this.resource) {
        this.resource.stop();
      }

      this.is_playing = false;
    },
    prev_recording: function () {
      this.scope.$broadcast('prev-visobject');
    },
    next_recording: function () {
      this.scope.$broadcast('next-visobject');
    },
    download: function (visobject) {
      if (a2UserPermit.isSuper()) return this.getExportUrl(visobject);

      if (a2UserPermit.all && !a2UserPermit.all.length || !a2UserPermit.can('export report')) {
        return notify.error('You do not have permission to download recording');
      }

      return this.getExportUrl(visobject);
    },
    getExportUrl: function (visobject) {
      const form = document.createElement('form');
      form.style.display = 'none';
      form.method = 'GET';
      const url = '/legacy-api/project/' + Project.getUrl() + '/recordings/download/' + visobject.id;
      form.action = url;
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    }
  };
  return a2AudioPlayer;
}]).factory('A2AudioObject', ['$window', '$interval', '$q', function ($window, $interval, $q) {
  var poll_loop_interval = 50; // 25;
  // var AudioContext = $window.AudioContext || $window.webkitAudioContext;

  function loadAudio(url) {
    var deferred = $q.defer();
    var audio = new $window.Audio();
    url = url.replace('|', '/');
    audio.addEventListener('error', function (err) {
      console.log('err', err);
      deferred.reject();
    });
    audio.addEventListener('loadstart', function () {
      deferred.resolve(audio);
    }); // bugfix for chrome...

    $window.setTimeout(function () {
      audio.src = url;
    }, 1);
    return deferred.promise;
  }

  var A2AudioObject = function (url) {
    var d = $q.defer();
    this.url = url;
    this.onCompleteListeners = [];
    this.interval = $interval(this._check_current_time.bind(this), poll_loop_interval);
    this.load_promise = loadAudio(url).then(function (nativeAudio) {
      this.audio = nativeAudio;
      this.audio.addEventListener('canplay', function () {
        this.duration = this.audio.duration;
        this.paused = this.audio.paused;
        this.src = this.audio.src;
        this.canPlay = true;
      }.bind(this));
      this.audio.addEventListener('error', function (err) {
        this.canPlay = false;
        console.log(err);
      }.bind(this));
    }.bind(this), function (error) {
      this.error = true;
      console.log('Unable to listen to your recordings due to corrupted data');
    }.bind(this));
  };

  A2AudioObject.prototype = {
    // disconnect_ctx: function(){
    //     return this.context.suspend().then((function(){
    //         if(this.ctx_filter){
    //             this.ctx_filter.max.disconnect();
    //             this.ctx_filter.min.disconnect();
    //         }
    //         if(this.ctx_gain){
    //             this.ctx_gain.disconnect();
    //         }
    //         this.ctx_source.disconnect();
    //         return this.context.resume();
    //     }).bind(this));
    // },
    // setup_ctx_connections: function(){
    //     return this.context.suspend().then((function(){
    //         var output = this.context.destination;
    //         if(this.ctx_gain){
    //             this.ctx_gain.connect(output);
    //             output = this.ctx_gain;
    //         }
    //         if(this.ctx_filter){
    //             this.ctx_filter.min.connect(output);
    //             this.ctx_filter.max.connect(this.ctx_filter.min);
    //             output = this.ctx_filter.max;
    //         }
    //         this.ctx_source.connect(output);
    //         return this.context.resume();
    //     }).bind(this));
    // },
    // setGain: function(gain){
    //     var d = $q.defer();
    //     this.gain = gain;
    //     var created=false;
    //     if(!this.ctx_gain){
    //         this.ctx_gain = this.context.createGain();
    //         created=true;
    //     }
    //     this.ctx_gain.gain.value = gain;
    //     if(created){
    //         this.setup_ctx_connections().then(d.resolve.bind(d), d.reject.bind(d));
    //     } else {
    //         d.resolve();
    //     }
    //     return d.promise;
    // },
    // setFrequencyFilter: function(filter){
    //     var d = $q.defer();
    //     d.resolve();
    //     var promise = d.promise;
    //     this.filter = filter;
    //     var need_to_connect=false;
    //     if(filter){
    //         var f0 = Math.sqrt(filter.max * (filter.min||1)), bw = filter.max - filter.min;
    //         var Q  = f0 / bw;
    //         if(!this.ctx_filter){
    //             this.ctx_filter = {
    //                 min:this.context.createBiquadFilter(),
    //                 max:this.context.createBiquadFilter()
    //             };
    //             this.ctx_filter.min.type.value = 'highpass';
    //             this.ctx_filter.max.type.value = 'lopass';
    //             this.ctx_filter.min.Q.value = 0.5;
    //             this.ctx_filter.max.Q.value = 0.5;
    //             need_to_connect = true;
    //         }
    //         this.ctx_filter.max.frequency.value = filter.max;
    //         this.ctx_filter.min.frequency.value = filter.min;
    //     } else if(!filter){
    //         if(this.ctx_filter){
    //             promise = this.disconnect_ctx().then((function(){
    //                 this.ctx_filter = undefined;
    //             }).bind(this));
    //             need_to_connect = true;
    //         }
    //     }
    //
    //     if(need_to_connect){
    //         promise = promise.then((function(){
    //             return this.setup_ctx_connections();
    //         }).bind(this));
    //     }
    //
    //     return promise;
    // },
    play: function () {
      // this.context.resume();
      this.audio.play();
      return this;
    },
    complete: function (callback) {
      this.onCompleteListeners.push(callback);
    },
    pause: function () {
      this.audio.pause(); // this.context.suspend();
    },
    restart: function () {
      this.audio.pause(); // this.context.suspend();

      this.audio.currentTime = 0;
    },
    stop: function () {
      this.restart();
    },
    discard: function () {
      if (!this.discarded) {
        this.discarded = true;
      }

      if (this.context) {
        this.context.close();
        this.context = undefined;
      }

      if (this.interval) {
        $interval.cancel(this.interval);
        this.interval = undefined;
      }
    },
    setVolume: function (volume) {
      this.unmutedVolume = volume;
      this.muted = false;
      this.audio.volume = volume;
    },
    setPlaybackRate: function (rate) {
      this.audio.playbackRate = rate;
    },
    setMuting: function (muting) {
      this.muted = muting;
      this.audio.volume = +this.muted * this.unmutedVolume;
    },
    setProgress: function (progress) {
      if (this.audio && this.audio.duration && isFinite(progress)) {
        this.audio.currentTime = this.audio.duration * progress;
      }
    },
    setCurrentTime: function (currentTime) {
      if (this.audio && this.audio.duration) {
        this.audio.currentTime = currentTime;
      }
    },
    _check_current_time: function () {
      if (this.audio) {
        this.currentTime = this.audio.currentTime;

        if (this.currentTime >= this.duration) {
          this.onCompleteListeners.forEach(function (listener) {
            listener(this);
          });
        }
      }
    }
  };
  return A2AudioObject;
}]);
angular.module('visualizer-layers', ['visualizer-services', 'a2.utils']).directive('a2VisualizerLayerItem', ["layer_types", "$compile", "$templateFetch", function (layer_types, $compile, $templateFetch) {
  return {
    restrict: 'E',
    replace: true,
    templateUrl: '/app/visualizer/layer-item/default.html',
    link: function (scope, element, attrs) {
      var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
      var layer_key = layer_types[layer_type] ? layer_types[layer_type].type : null;

      if (layer_key && layer_key != 'default') {
        var layer_url = '/app/visualizer/layer-item/' + layer_key + '.html';
        var layer_tmp = $templateFetch(layer_url, function (layer_tmp) {
          var layer_el = $compile(layer_tmp)(scope);
          element.append(layer_el.children().unwrap());
        });
      }
    }
  };
}]);
angular.module('visualizer-services', ['a2.services']).provider('layer_types', function () {
  var type_array = [];
  return {
    addLayerType: function (layerType) {
      type_array.push(layerType);
      return this;
    },
    $get: function () {
      var layer_types = {};
      type_array.forEach(function (lt) {
        layer_types[lt.type] = lt;
      });
      return layer_types;
    }
  };
}).service('a2VisualizerLayers', ["layer_types", "$controller", function (layer_types, $controller) {
  var layers = function ($scope, VisualizerCtrl) {
    this.$scope = $scope;
    this.VisualizerCtrl = VisualizerCtrl;
    this.list = [];
  };

  layers.prototype = {
    types: layer_types,
    __new_layer__: function (layer_type) {
      var layer_def = this.types[layer_type];

      if (layer_def) {
        var layer_maker = function () {};

        layer_maker.prototype = layer_def;
        var layer = new layer_maker();

        if (layer.controller && typeof layer.controller == 'string') {
          var cname = /^(.*?)( as (.*?))$/.exec(layer.controller);

          if (cname) {
            layer[cname[2] ? cname[3] : 'controller'] = $controller(cname[1], {
              $scope: this.$scope,
              VisualizerCtrl: this.VisualizerCtrl
            });
          }
        }

        return layer;
      } else {
        return null;
      }
    },
    add: function () {
      for (var a = arguments, i = 0, e = a.length; i < e; ++i) {
        var layer_type = a[i];

        if (layer_types[layer_type]) {
          this.list.push(this.__new_layer__(layer_type));
        } else {
          console.warn("Unknown layer of type " + layer_type + ".");
        }
      }
    },
    __check_type: function (reqtype, curtype) {
      if (reqtype instanceof Array) {
        var idx = reqtype.indexOf(curtype);

        if (idx == -1) {
          return false;
        }
      } else if (curtype != reqtype) {
        return false;
      }

      return true;
    },
    check_requirements: function (req) {
      var browsetype = this.$scope.visobject_type;
      var votype = this.$scope.visobject ? this.$scope.visobject.type : browsetype;

      if (!req) {
        return true;
      } else if (req.selection && !this.$scope.visobject) {
        return false;
      } else if (req.type && !this.__check_type(req.type, votype)) {
        return false;
      } else if (req.browsetype && !this.__check_type(req.browsetype, browsetype)) {
        return false;
      } else if (req.that && !req.that(this.$scope)) {
        return false;
      }

      return true;
    },
    sidebar_visible: function (l) {
      if (l.sidebar_visible && !l.sidebar_visible($scope)) {
        return false;
      } else if (!this.check_requirements(l.require)) {
        return false;
      }

      return true;
    },
    spectrogram_visible: function (l) {
      return this.check_requirements(l.require) && l.visible;
    },
    display_sidebar: function (l) {
      return !l.display || l.display.sidebar !== false;
    },
    display_spectrogram: function (l) {
      return !l.display || l && l.display && l.display.spectrogram !== false;
    }
  };
  return layers;
}]).provider('training_set_types', function () {
  var training_set_types = [];
  return {
    add: function (type) {
      training_set_types.push(type);
      return this;
    },
    $get: function () {
      return training_set_types.reduce(function (_, tst) {
        _[tst.type] = tst;
        return _;
      }, {});
    }
  };
}).controller('a2ProjectClasses', ["Project", function (Project) {
  var self = this;
  Project.getClasses(function (list) {
    self.list = list;
  });
}]).service('a22PointBBoxEditor', ["$timeout", "a2TrainingSets", "training_set_types", function ($timeout, a2TrainingSets, training_set_types) {
  var editor = function () {
    this.min_eps = 0.001;
    this.scalex = 1.0;
    this.scaley = 0.001;
    this.reset();
  };

  editor.prototype = {
    reset: function () {
      this.bbox = null;
      this.points = null;
      this.tracer = null;
      this.valid = false;
      return this;
    },
    make_new_bbox: function () {
      this.bbox = {};
      this.points = [];
      this.valid = false;
    },
    add_tracer_point: function (x, y) {
      if (this.bbox && !this.valid) {
        var tracer = [x, y];
        this.tracer = tracer;
        this.validate([tracer]);
      }
    },
    add_point: function (x, y, min_eps) {
      min_eps = min_eps || this.min_eps;
      var similars = this.points && this.points.filter(function (pt) {
        var dx = (pt[0] - x) * this.scalex,
            dy = (pt[1] - y) * this.scaley,
            dd = dx * dx + dy * dy;
        return dd <= min_eps;
      });

      if (similars && similars.length > 0) {
        return;
      }

      if (!this.bbox) {
        this.make_new_bbox();
      }

      if (this.points.length < 2) {
        this.points.push([x, y]);
      }

      this.validate();
    },
    validate: function (tmp_points) {
      var pts_x = this.points.map(function (x) {
        return x[0];
      });
      var pts_y = this.points.map(function (x) {
        return x[1];
      });

      if (tmp_points) {
        pts_x.push.apply(pts_x, tmp_points.map(function (x) {
          return x[0];
        }));
        pts_y.push.apply(pts_y, tmp_points.map(function (x) {
          return x[1];
        }));
      }

      this.bbox.x1 = Math.min.apply(null, pts_x);
      this.bbox.y1 = Math.min.apply(null, pts_y);
      this.bbox.x2 = Math.max.apply(null, pts_x);
      this.bbox.y2 = Math.max.apply(null, pts_y);
      this.valid = this.points.length >= 2;
    }
  };
  editor.prototype.super = editor.prototype;
  return editor;
}]);
angular.module('a2.soundscapeRegionTags', ['a2.infotags']).directive('a2SoundscapeRegionTag', ["$injector", function ($injector) {
  var clsprefix = 'label-';

  var resolve_tag = function (scope, element, tag) {
    var txt = element.children('.txt');
    var label_classes = ['default', 'primary', 'success', 'info', 'warning', 'danger'];
    var default_colors_by_type = {
      species_sound: 'blue'
    };

    if (!tag) {
      element.hide();
    } else {
      element.show();
    }

    scope.class = "";
    scope.style = {};

    if (typeof tag == 'string') {
      txt.text(tag);
      scope.class = clsprefix + "default";
    } else {
      var type = tag.type;
      var text = tag.text || tag.tag;
      var color = tag.color || 'default';
      scope.count = tag.count === undefined ? '' : tag.count | 0;

      if (type == 'species_sound') {
        $injector.invoke(resolve_species_tag, this, {
          element: txt,
          text: text,
          $scope: scope
        });
      } else {
        type = 'normal';
        txt.text(text);
      }

      if (color == 'default' && default_colors_by_type[type]) {
        color = default_colors_by_type[type];
      }

      if (label_classes.indexOf(color) >= 0) {
        scope.class = clsprefix + color;
      } else {
        scope.style['background-color'] = color;
      }
    }
  };

  var resolve_species_tag = function (element, text, $compile, $scope) {
    element.empty().append($compile('<a2-species species="' + (text | 0) + '"></a2-species species>')($scope));
  };
  resolve_species_tag.$inject = ["element", "text", "$compile", "$scope"];

  return {
    restrict: 'E',
    scope: {
      tag: '=',
      closeable: '=?',
      showCount: '=?',
      onClose: '&'
    },
    replace: true,
    templateUrl: '/app/visualizer/soundscape-region-tag.html',
    link: function (scope, element, $attrs) {
      scope.$watch('tag', function (tag) {
        resolve_tag(scope, element, tag);
      });
    }
  };
}]);
angular.module('visualizer-spectrogram', ['visualizer-services', 'a2.filter.round', 'a2.utils']).service('a2AffixCompute', function () {
  return function ($viewport, $el, layout) {
    var v;
    var affix_c = $el.attr('data-affix-container');

    if (affix_c) {
      v = layout[affix_c];
    }

    if (!v) {
      v = {
        left: 0,
        top: 0,
        width: $viewport.width(),
        height: $viewport.height()
      };
    }

    var e = {
      width: $el.width(),
      height: $el.height()
    };
    var affix_left = $el.attr('data-affix-left') | 0;
    var affix_right = $el.attr('data-affix-right');
    var affix_align_h = $el.attr('data-affix-align-h');

    if (affix_right !== undefined) {
      affix_left = v.left + v.width - $el.width() - (affix_right | 0);
    } else if (affix_align_h !== undefined) {
      affix_left = v.left + (v.width - $el.width()) * affix_align_h;
    } else {
      affix_left += v.left;
    }

    var affix_top = $el.attr('data-affix-top') | 0;
    var affix_bottom = $el.attr('data-affix-bottom');
    var affix_align_v = $el.attr('data-affix-align-v');

    if (affix_bottom !== undefined) {
      affix_top = v.top + v.height - $el.height() - (affix_bottom | 0);
    } else if (affix_align_v !== undefined) {
      affix_top = v.top + (v.height - $el.height()) * affix_align_v;
    } else {
      affix_top += v.top;
    }

    $el.css({
      position: 'absolute',
      left: Math.round(affix_left + $viewport.scrollLeft()),
      top: Math.round(affix_top + $viewport.scrollTop())
    });
  };
}).directive('a2VisualizerSpectrogram', ["a2BrowserMetrics", "a2AffixCompute", function (a2BrowserMetrics, a2AffixCompute) {
  return {
    restrict: 'E',
    templateUrl: '/app/visualizer/visualizer-spectrogram.html',
    replace: true,
    link: function ($scope, $element, $attrs) {
      var layout_tmp = $scope.layout.tmp;
      var views = {
        viewport: $element.children('.spectrogram-container')
      };

      $scope.onPlaying = function (e) {
        $scope.layout.y_axis.left = $element.scrollLeft();
        $element.children('.axis-y').css({
          left: $scope.layout.y_axis.left + 'px'
        });
        $scope.layout.x_axis.top = Math.min($scope.layout.spectrogram.top + $scope.layout.spectrogram.height, $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh);
        $element.children('.axis-x').css({
          top: $scope.layout.x_axis.top + 'px'
        });
      };

      $scope.onScrolling = function (e) {
        var layout = $scope.layout;
        var max_s_h = layout.spectrogram.height - layout.viewport.height;
        var max_s_w = layout.spectrogram.width - layout.viewport.width;

        if ($element.scrollTop() > max_s_h) {
          $element.scrollTop(max_s_h);
        }

        if ($element.scrollLeft() > max_s_w) {
          $element.scrollLeft(max_s_w);
        }

        layout.bbox = {
          s1: ($element.scrollLeft() - layout.spectrogram.left) / layout.scale.sec2px,
          s2: ($element.scrollLeft() - layout.spectrogram.left + $element.width()) / layout.scale.sec2px,
          hz1: (layout.spectrogram.top + layout.spectrogram.height - $element.scrollTop() - $element.height()) / layout.scale.hz2px,
          hz2: (layout.spectrogram.top + layout.spectrogram.height - $element.scrollTop()) / layout.scale.hz2px
        };
        layout.center = {
          s: ($element.scrollLeft() - layout.spectrogram.left + $element.width() / 2.0) / layout.scale.sec2px,
          hz: (layout.spectrogram.top + layout.spectrogram.height - $element.scrollTop() - $element.height() / 2.0) / layout.scale.hz2px
        };
        layout.y_axis.left = $element.scrollLeft();
        $element.children('.axis-y').css({
          left: layout.y_axis.left + 'px'
        });
        layout.x_axis.top = $element.scrollTop() + $element.height() - layout_tmp.axis_sizeh - layout_tmp.gutter;
        $element.children('.axis-x').css({
          top: layout.x_axis.top - 1 + 'px'
        });

        if (layout.legend) {
          layout.legend.left = $element.scrollLeft() + $element.width() - a2BrowserMetrics.scrollSize.width - layout_tmp.legend_width - layout_tmp.legend_gutter;
          $element.children('.legend').css({
            left: layout.legend.left + 'px'
          });
        }

        $element.find('.a2-visualizer-spectrogram-affixed').each(function (i, el) {
          a2AffixCompute($element, $(el), layout);
        });
      };

      $scope.onMouseMove = function (e) {
        var elOff = $element.offset();
        var x = e.pageX - elOff.left + $element.scrollLeft() - $scope.layout.spectrogram.left;
        var y = e.pageY - elOff.top + $element.scrollTop() - $scope.layout.spectrogram.top;
        x = Math.min(Math.max(x, 0), $scope.layout.spectrogram.width);
        y = Math.min(Math.max(y, 0), $scope.layout.spectrogram.height);
        $scope.pointer.x = x;
        $scope.pointer.y = y;
        $scope.pointer.sec = $scope.layout.x2sec(x);
        $scope.pointer.hz = $scope.layout.y2hz(y);
      };

      var make_axis = function (domain, scale, orientation) {
        var axis = d3.svg.axis();

        if (domain.ticks) {
          axis.ticks(domain.ticks);
        }

        if (domain.tick_format) {
          axis.tickFormat(domain.tick_format);
        } else if (domain.unit_format) {
          axis.tickFormat(domain.unit_format);
        }

        axis.scale(scale).orient(orientation);
        return axis;
      };

      $scope.layout.listeners.push(function (layout, container, $scope, width, height, fix_scroll_center) {
        doLayout(layout, container, $scope, width, height, fix_scroll_center);
      });

      function doLayout(layout, container, $scope, width, height, fix_scroll_center) {
        var domain = layout.l.domain || {};
        var components = {
          visualizer_root: container,
          spectrogram: container.children('.spectrogram-container'),
          y_axis: domain.y && container.children('.axis-y'),
          x_axis: domain.x && container.children('.axis-x'),
          legend: domain.legend && container.children('.legend')
        };
        Object.keys(components).forEach(function (i) {
          var component = components[i];

          if (component) {
            var $li = component;
            var li = layout.l[i];

            if (li.css) {
              $li.css(li.css);
            }

            if (li.attr) {
              $li.attr(li.attr);
            }
          }
        });

        if (domain.x) {
          doXAxisLayout(layout);
        }

        if (domain.y) {
          doYAxisLayout(layout);
        }

        if (domain.legend) {
          doLegendLayout(layout);
        }

        if (fix_scroll_center) {
          $element.scrollTop(Math.min(layout.l.scroll_center.top, layout.l.spectrogram.css.height - layout.viewport.height));
          $element.scrollLeft(Math.min(layout.l.scroll_center.left, layout.l.spectrogram.css.width - layout.viewport.width));
        }

        $scope.onScrolling();
      }

      function doXAxisLayout(layout) {
        var d3_x_axis = d3.select($element.children('.axis-x').empty()[0]);
        var spec_h = layout.spectrogram.height;
        var domain = layout.l.domain;
        var scalex = layout.l.scale.x;
        d3_x_axis.style('height', 100);
        d3_x_axis.style('scale', 'none');
        d3_x_axis.append("rect").attr({
          class: 'bg',
          x: 0,
          y: 1,
          width: layout.l.x_axis.attr.width,
          height: spec_h + layout_tmp.axis_lead
        });
        d3_x_axis.append("g").attr('class', 'axis').attr('transform', 'translate(' + layout_tmp.axis_lead + ', 1)').call(make_axis(domain.x, scalex, "bottom"));
      }

      function doYAxisLayout(layout) {
        var d3_y_axis = d3.select($element.children('.axis-y').empty()[0]);
        var spec_h = layout.spectrogram.height;
        var domain = layout.l.domain;
        var scaley = layout.l.scale.y;
        d3_y_axis.style('width', 61);
        d3_y_axis.style('scale', 'none');
        d3_y_axis.append("rect").attr({
          class: 'bg',
          x: 0,
          y: 0,
          width: layout.l.y_axis.attr.width + 1,
          height: spec_h + layout_tmp.axis_lead + 1
        });
        d3_y_axis.append("rect").attr({
          class: 'bg',
          x: 0,
          y: 0,
          width: layout.l.y_axis.attr.width - layout_tmp.axis_lead,
          height: spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
        });
        d3_y_axis.append("g").attr('class', 'axis').attr('transform', 'translate(' + layout_tmp.axis_sizew + ', ' + layout_tmp.axis_lead + ')').call(make_axis(domain.y, scaley, "left"));
      }

      function doLegendLayout(layout) {
        var d3_legend = d3.select($element.children('.legend').empty()[0]);
        var spec_h = layout.spectrogram.height;
        var domain = layout.l.domain;
        d3_legend.append("rect").attr({
          class: 'bg',
          x: layout_tmp.axis_lead,
          y: 0,
          width: layout.l.legend.attr.width,
          height: layout.l.legend.attr.height
        });
        d3_legend.append("image").attr({
          class: 'legend-image',
          x: layout_tmp.legend_axis_w,
          y: layout_tmp.axis_lead,
          width: layout_tmp.legend_width - layout_tmp.legend_axis_w,
          height: spec_h,
          preserveAspectRatio: 'none',
          'xlink:href': domain.legend.src
        });
        d3_legend.append("rect").attr({
          class: 'border',
          x: layout_tmp.legend_axis_w,
          y: layout_tmp.axis_lead,
          width: layout_tmp.legend_width - layout_tmp.legend_axis_w,
          height: spec_h
        });
        d3_legend.append("g").attr('class', 'axis').attr('transform', 'translate(' + layout_tmp.legend_axis_w + ', ' + (layout_tmp.axis_lead + 1) + ')').call(make_axis(domain.legend, layout.l.scale.legend, "left"));
      }

      $scope.getRecordingPlaybackTime = function () {
        return $scope.audio_player.getCurrentTime();
      };

      $scope.$watch(function () {
        return {
          'h': $element.height(),
          'w': $element.width()
        };
      }, function (newValue, oldValue) {
        $scope.layout.apply($element, $scope, newValue.w, newValue.h, true);
      }, true);
      $scope.$watch(function () {
        return $scope.layout.scale.sec2px * $scope.getRecordingPlaybackTime() | 0;
      }, function (newValue, oldValue) {
        if ($scope.audio_player.is_playing) {
          var pbh = layout_tmp.axis_sizew + newValue;
          var sl = $element.scrollLeft(),
              slw = sl + $element.width() / 2;
          var dx = pbh - slw;

          if (dx > 0) {
            $element.scrollLeft(sl + dx);
          }
        }
      }, true);
      $scope.$watch('visobject', function (newValue, oldValue) {
        $element.scrollLeft(0);
        $element.scrollTop(999999);
        $scope.layout.apply($element, $scope, $element.width(), $element.height());
      }, true);
      $element.bind('resize', function () {
        $scope.$apply();
      });
      $scope.$watch('layout.scale.zoom.x', function (newValue, oldValue) {
        $scope.layout.apply($element, $scope, $element.width(), $element.height(), true);
      });
      $scope.$watch('layout.scale.zoom.y', function (newValue, oldValue) {
        $scope.layout.apply($element, $scope, $element.width(), $element.height(), true);
      });
      $scope.$watch('layout.scale.originalScale', function (newValue, oldValue) {
        $scope.layout.apply($element, $scope, $element.width(), $element.height(), true);
      });
      $scope.layout.apply($element, $scope, $element.width(), $element.height());
      $scope.onScrolling();
    }
  };
}]).directive('a2VisualizerSpectrogramLayer', ["layer_types", "$compile", "$templateFetch", function (layer_types, $compile, $templateFetch) {
  return {
    restrict: 'E',
    templateUrl: '/app/visualizer/spectrogram-layer/default.html',
    replace: true,
    link: function (scope, element, attrs) {
      //console.log("link     : function(scope, element, attrs){", scope, element, attrs);
      var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
      var layer_key = layer_types[layer_type] ? layer_types[layer_type].type : null;
      element.addClass(layer_type);

      if (layer_key && layer_key != 'default') {
        var layer_url = '/app/visualizer/spectrogram-layer/' + layer_key + '.html';
        var layer_tmp = $templateFetch(layer_url, function (layer_tmp) {
          var layer_el = $compile(layer_tmp)(scope);
          element.append(layer_el);
        });
      }
    }
  };
}]).directive('a2VisualizerSpectrogramAffixed', ["a2AffixCompute", "$debounce", function (a2AffixCompute, $debounce) {
  return {
    restrict: 'A',
    link: function ($scope, $element, $attrs) {
      $element.addClass('a2-visualizer-spectrogram-affixed');
      var $root = $element.closest('.visualizer-root');
      var $eloff = $element.offset(),
          $roff = $root.offset();

      if ($roff) {
        if ($element.attr('data-affix-left') === undefined) {
          $element.attr('data-affix-left', $eloff.left - $roff.left);
        }

        if ($element.attr('data-affix-top') === undefined) {
          $element.attr('data-affix-top', $eloff.top - $roff.top);
        }
      }

      if ($attrs.a2VisualizerSpectrogramAffixed) {
        $scope.$watch($attrs.a2VisualizerSpectrogramAffixed, function (newval, oldval) {
          var i;

          if (oldval) {
            for (i in oldval) {
              $element.attr('data-affix-' + i, null);
            }
          }

          if (newval) {
            for (i in newval) {
              $element.attr('data-affix-' + i, newval[i]);
            }
          }
        });
        a2AffixCompute($element.offsetParent(), $element, $scope.layout);
      }

      a2AffixCompute($element.offsetParent(), $element, $scope.layout);
      $scope.$watch(function () {
        return $element.width() * $element.height();
      }, $debounce(function () {
        a2AffixCompute($element.offsetParent(), $element, $scope.layout);
      }));
    }
  };
}]);
angular.module('a2.speciesValidator', ['a2.utils', 'a2.infotags']).directive('a2SpeciesValidator', ["Project", "a2UserPermit", "notify", "$filter", function (Project, a2UserPermit, notify, $filter) {
  var project = Project;
  return {
    restrict: 'E',
    scope: {
      recording: '=recording'
    },
    templateUrl: '/app/visualizer/validator-main.html',
    link: function ($scope, $element, $attrs) {
      var class2key = function (project_class) {
        var cls;

        if (/number|string/.test(typeof project_class)) {
          cls = $scope.classes.filter(function (pc) {
            return pc.id == project_class;
          }).shift();
        } else {
          cls = project_class;
        }

        return cls && [cls.species, cls.songtype].join('-');
      };

      var add_validation = function (validation) {
        var key = [validation.species, validation.songtype].join('-');
        var present = Object.values({
          present: validation.present,
          presentReview: validation.presentReview,
          presentAed: validation.presentAed
        });
        $scope.validations[key] = present;
      };

      var load_project_classes = function () {
        Project.getClasses(function (classes) {
          $scope.classes = classes;
          var taxons = {};

          for (var i = 0; i < classes.length; i++) {
            var c = classes[i];
            if (!taxons[c.taxon]) taxons[c.taxon] = [];
            taxons[c.taxon].push(c);
          }

          for (var t in taxons) {
            taxons[t] = $filter('orderBy')(taxons[t], ['species_name', 'songtype_name']);
          }

          $scope.byTaxon = taxons;
          $scope.taxons = Object.keys($scope.byTaxon).sort();
        });
      };

      $scope.$on('a2-persisted', load_project_classes);
      $scope.classes = [];
      $scope.is_selected = {};

      $scope.select = function (taxon, project_class, $event) {
        if ($($event.target).is('a')) {
          return;
        }

        if ($event.shiftKey) {
          $scope.is_selected[project_class.id] = true;
          var sel_range = {
            from: Infinity,
            to: -Infinity
          };
          var taxonSpecies = $scope.byTaxon[taxon];
          taxonSpecies.forEach(function (pc, idx) {
            if ($scope.is_selected[pc.id]) {
              sel_range.from = Math.min(sel_range.from, idx);
              sel_range.to = Math.max(sel_range.to, idx);
            }
          });

          for (var si = sel_range.from, se = sel_range.to + 1; si < se; ++si) {
            $scope.is_selected[taxonSpecies[si].id] = true;
          }
        } else if ($event.ctrlKey) {
          $scope.is_selected[project_class.id] = !$scope.is_selected[project_class.id];
        } else {
          $scope.is_selected = {};
          $scope.is_selected[project_class.id] = true;
        }
      };

      $scope.validations = {};

      $scope.validate = function (val) {
        if (!a2UserPermit.can('validate species')) {
          notify.error('You do not have permission to validate species');
          return;
        }

        var keys = [],
            key_idx = {};
        var k; // var k = class2key(project_class);
        // if (k && !key_idx[k]) {
        //     key_idx[k] = true;
        //     keys.push(k);
        // }
        // sel_pc_id -> selected project class id

        for (var sel_pc_id in $scope.is_selected) {
          if ($scope.is_selected[sel_pc_id]) {
            k = class2key(sel_pc_id);

            if (k && !key_idx[k]) {
              key_idx[k] = true;
              keys.push(k);
            }
          }
        }

        if (keys.length > 0) {
          Project.validateRecording($scope.recording.id, {
            'class': keys.join(','),
            val: val,
            determinedFrom: 'visualizer'
          }, function (validations) {
            validations.forEach(function (validation) {
              var key = class2key(validation);

              if (validation.val == 2) {
                delete $scope.validations[key];
              } else {
                $scope.validations[key] = Object.values({
                  present: validation.val,
                  presentReview: 0
                });
              }
            });
          });
        }
      };

      $scope.val_options = [{
        label: "Clear",
        val: 2
      }, {
        label: "Present",
        val: 1
      }, {
        label: "Absent",
        val: 0
      }];

      $scope.val_state = function (project_class, val_options) {
        if (!val_options) {
          val_options = $scope.val_options;
        }

        var key = class2key(project_class),
            val = $scope.validations[key];

        if (typeof val === 'undefined') {
          return;
        } else {
          if (val[0] == 1 || val[1] > 0 || val[2] > 0) {
            val_options[1].showDropdown = val[1] > 0 || val[2] > 0;
            return val_options[1];
          }

          if (val[0] == null && val[1] == 0 && val[2] == 0) {
            return;
          } else {
            return val_options[2];
          }
        }
      };

      $scope.$watch('recording', function (recording) {
        $scope.validations = {};

        if (recording && recording.validations) {
          recording.validations.forEach(add_validation);
        }
      });
      load_project_classes();
    }
  };
}]);
/**
 * @ngdoc overview
 * @name visualizer-sidebar
 * @description
 * Sidebar directive for the visualizer module.
 */
angular.module('a2.visualizer.directive.sidebar', []).directive('visualizerSidebar', function () {
  return {
    restrict: 'E',
    transclude: true,
    templateUrl: '/app/visualizer/visualizer-sidebar.html',
    scope: {
      closed: '=?'
    },
    link: function (scope, element, attrs) {
      element.addClass("sidebar show");
      checkClosed();

      scope.toggleSidebar = function () {
        scope.closed = !scope.closed;
        checkClosed();
      };

      function checkClosed() {// element[scope.closed ? 'addClass' : 'removeClass']("collapsed");
      }
    }
  };
});
// $(document)
//   .on('click.bs.dropdown.data-api', '.dropdown .dropdown-form', function (e) { e.stopPropagation(); });

/**
 * @ngdoc overview
 * @name visualizer
 * @description
 * This is the main visualizer module.
 */
angular.module('a2.visualizer', ['ui.router', 'ct.ui.router.extras', 'a2.services', 'a2.utils', 'a2.visobjects', 'a2.visualizer.dialog', 'a2.visobjectsbrowser', 'a2.speciesValidator', 'visualizer-layers', 'a2.visualizer.directive.sidebar', 'a2.visualizer.layers.base-image-layer', 'a2.visualizer.layers.annotation-layer', 'a2.visualizer.layers.zoom-input-layer', 'a2.visualizer.layers.data-plot-layer', 'a2.visualizer.layers.recordings', 'a2.visualizer.layers.recording-soundscape-region-tags', 'a2.visualizer.layers.recording-tags', 'a2.visualizer.layers.species-presence', 'a2.visualizer.layers.soundscapes', 'a2.visualizer.layers.soundscape-composition-tool', 'a2.visualizer.layers.training-sets', 'a2.visualizer.layers.templates', 'a2.visualizer.layers.audio-events-layer', 'visualizer-spectrogram', 'visualizer-services', 'a2.visualizer.audio-player', 'a2-visualizer-spectrogram-Layout', 'a2-visualizer-spectrogram-click2zoom', 'a2.url-update-service', 'ui.bootstrap'])
/**
 * @ngdoc service
 * @name a2-visualizer-spectrogram-Layout.factory:VisualizerLayout
 * @description
 * The layout manager for the spectrogram.
 */
.config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('visualizer', {
    url: '/visualizer',
    views: {
      'visualizer': {
        controller: 'VisualizerCtrl',
        templateUrl: '/app/visualizer/main.html'
      }
    },
    deepStateRedirect: true,
    sticky: true
  }).state('visualizer.view', {
    url: '/:type/:idA/:idB/:idC?gain&filter&a&clusters',
    params: {
      type: '',
      a: null,
      clusters: null,
      gain: null,
      filter: null,
      idA: {
        value: '',
        squash: true
      },
      idB: {
        value: null,
        squash: true
      },
      idC: {
        value: null,
        squash: true
      }
    },
    controller: ["$state", "$scope", function ($state, $scope) {
      var p = $state.params;
      var lc = [p.type];

      if (p.idA) {
        lc.push(p.idA);

        if (p.idB) {
          lc.push(p.idB);

          if (p.idC) {
            lc.push(p.idC);
          }
        }
      }

      var l = lc.join('/');
      $scope.location.whenBrowserIsAvailable(function () {
        $scope.$parent.$broadcast('set-browser-location', l, p.a); // Catch the navigation URL query

        if (p.type === 'rec') {
          $scope.$parent.$broadcast('set-browser-annotations', p.idA ? Number(p.idA) : null, p.a ? p.a : null);
        }
      });

      if ($scope.parseAnnotations) {
        $scope.parseAnnotations(p.a);
      }
    }]
  });
}]).directive('a2Visualizer', function () {
  return {
    restrict: 'E',
    replace: true,
    scope: {},
    controller: 'VisualizerCtrl',
    templateUrl: '/app/visualizer/main.html'
  };
}).service('a2VisualizerLocationManager', ["$location", function ($location) {
  var locman = function (scope, prefix, state) {
    this.scope = scope;
    this.state = state;
    this.prefix = prefix;
    this.current = '';
    this.__expected = '';
  };

  locman.prototype = {
    sync: function () {
      if (this.current == this.__expected) {
        return;
      }

      this.__expected = this.current;
      this.scope.$broadcast('set-browser-location', this.current);
    },
    update_path: function () {
      this.set(this.current);
    },
    updateParams: function (params) {
      var all_params = angular.extend({}, this.state.params);

      for (var pk in params) {
        var pv = params[pk];

        if (pv === undefined) {
          delete all_params[pk];
        } else {
          all_params[pk] = pv;
        }
      }

      console.log(all_params, this.state.current.name);
      this.state.transitionTo(this.state.current.name, all_params, {
        notify: false
      });
    },
    set: function (location, dont_sync) {
      if (dont_sync) {
        this.__expected = location;
      }

      if ($location.path() != this.prefix + location) {
        console.log('a2VisualizerLocationManager::set_location', this.prefix + location, dont_sync);
        var search = $location.search();
        delete search.a;
        $location.path(this.prefix + location);
        $location.search(search);
      }
    },
    path_changed: function (path) {
      if (path === undefined) {
        path = $location.path();
      }

      path = '' + path;

      if (path.indexOf(this.prefix) === 0) {
        this.current = path.substr(this.prefix.length);
      }
    },
    whenBrowserIsAvailable: function (callback) {
      if (this.browserAvailable) {
        callback();
      } else {
        (this.__onBrowserAvailable__ || (this.__onBrowserAvailable__ = [])).push(callback);
      }
    },
    notifyBrowserAvailable: function () {
      this.browserAvailable = true;

      if (this.__onBrowserAvailable__) {
        this.__onBrowserAvailable__.forEach(function (callback) {
          callback();
        });

        delete this.__onBrowserAvailable__;
      }
    }
  };
  return locman;
}]).controller('VisualizerCtrl', ["a2VisualizerLayers", "$q", "$location", "$state", "$scope", "$localStorage", "$timeout", "itemSelection", "Project", "$controller", "a2UserPermit", "a2SpectrogramClick2Zoom", "$rootScope", "VisualizerObjectTypes", "VisualizerLayout", "a2AudioPlayer", "a2VisualizerLocationManager", "a2EventEmitter", function (a2VisualizerLayers, $q, $location, $state, $scope, $localStorage, $timeout, itemSelection, Project, $controller, a2UserPermit, a2SpectrogramClick2Zoom, $rootScope, VisualizerObjectTypes, VisualizerLayout, a2AudioPlayer, a2VisualizerLocationManager, a2EventEmitter) {
  var events = new a2EventEmitter();
  this.on = events.on.bind(events);
  this.off = events.off.bind(events);
  var layers = new a2VisualizerLayers($scope, this);
  var layer_types = layers.types;
  var initial_state_params = {
    gain: $state.params.gain,
    filter: $state.params.filter
  };

  $scope.parseAnnotations = function (annotationsString) {
    $scope.annotations = annotationsString ? (Array.isArray(annotationsString) ? annotationsString : annotationsString.split('|')).map(function (item) {
      var comps = item.split(',');
      var parsed = {
        type: comps.shift(),
        value: []
      };
      comps.forEach(function (comp) {
        var pair = comp.split(':');

        if (pair.length > 1) {
          var key = pair.shift();
          parsed[key] = pair[1].join(':');
        } else {
          parsed.value.push(comp);
        }
      });
      return parsed;
    }) : [];
  }; // check selected clusters in query


  if ($state.params.clusters) {
    $localStorage.setItem('analysis.clusters.playlist', $state.params.idA);
  }

  $scope.parseAnnotations($state.params.a);
  $scope.layers = layers.list; // current layers in the visualizer

  $scope.addLayer = layers.add.bind(layers);
  $scope.fullfillsRequirements = layers.check_requirements.bind(layers);
  $scope.isSidebarVisible = layers.sidebar_visible.bind(layers);
  $scope.isSpectrogramVisible = layers.spectrogram_visible.bind(layers);
  $scope.canDisplayInSidebar = layers.display_sidebar.bind(layers);
  $scope.canDisplayInSpectrogram = layers.display_spectrogram.bind(layers);

  if (a2UserPermit.all && a2UserPermit.all.length === 1 && a2UserPermit.all.includes('use citizen scientist interface') && !a2UserPermit.can('delete project') && !a2UserPermit.isSuper()) {
    layers.add('base-image-layer', 'recording-layer', 'templates', 'zoom-input-layer');
  } else {
    layers.add('base-image-layer', 'annotation-layer', 'data-plot-layer', 'recording-layer', 'recording-tags-layer', 'soundscape-info-layer', 'soundscape-regions-layer', 'recording-soundscape-region-tags', 'species-presence', 'training-data', 'templates', 'soundscape-composition-tool', 'zoom-input-layer', 'audio-events-layer');
  }

  $scope.visobject = null;
  var location = new a2VisualizerLocationManager($scope, '/visualizer' + '/', $state);
  $scope.location = location;
  $scope.annotation = {};
  $scope.set_location = location.set.bind(location);
  $scope.layout = new VisualizerLayout();
  $scope.click2zoom = new a2SpectrogramClick2Zoom($scope.layout);
  $scope.Math = Math;
  $scope.pointer = {
    x: 0,
    y: 0,
    sec: 0,
    hz: 0
  };
  $scope.selection = itemSelection.make('layer');

  $scope.getLayers = function () {
    return $scope.layers;
  };

  $scope.setVisObject = function (visobject, type, location) {
    if ($scope.isUploading) return;
    $scope.isUploading = true;
    return $q.resolve().then(function () {
      if (visobject) {
        $scope.visobject_location = location;
        $scope.location.set(location, true);
        var visobject_loader = VisualizerObjectTypes.getLoader(type);
        $scope.loading_visobject = visobject_loader.getCaptionFor(visobject);
        return visobject_loader.load(visobject, $scope).then(function (visobject) {
          console.log('VisObject loaded : ', visobject);
          $scope.$parent.$broadcast('clear-recording-data', true); // check clusters playlist in local storage else clear local storage

          if ($localStorage.getItem('analysis.clusters.playlist') === $state.params.idA) {
            var clustersData = JSON.parse($localStorage.getItem('analysis.clusters'));
            console.log('clustersData', this.clustersData);

            if (clustersData && clustersData.boxes && $state.params.idB) {
              this.parseAnnotations(clustersData.boxes[$state.params.idB]);
            }
          } else {
            $scope.removeFromLocalStorage();
            this.parseAnnotations($location.search().a);
          }

          $scope.loading_visobject = false;
          $scope.visobject = visobject;
          $scope.visobject_type = visobject.type;
          $scope.setYScaleOptions();
        }.bind(this));
      } else {
        $scope.visobject = null;
      }
    }.bind(this)).then(function () {
      events.emit('visobject', $scope.visobject);
      $scope.isUploading = false;
    });
  };

  $scope.removeFromLocalStorage = function () {
    $localStorage.setItem('analysis.clusters', null);
    $localStorage.setItem('analysis.clusters.playlist', null);
    $state.params.clusters = '';
  }; // Resize Y scale.


  $scope.getSelectedFrequencyCache = function () {
    try {
      return JSON.parse($localStorage.getItem('visuilizer.frequencies.cache')) || {
        originalScale: true
      };
    } catch (e) {
      return {
        originalScale: true
      };
    }
  };

  $scope.deselectFrequencyOptions = function () {
    $scope.yAxisOptions.forEach(function (item) {
      return item.active = false;
    });
  };

  $scope.setYScaleOptions = function () {
    // Get selected frequency.
    $scope.scaleCache = $scope.getSelectedFrequencyCache(); // Get recording frequency.

    $scope.convertedScale = $scope.visobject && $scope.visobject.max_freq ? +$scope.visobject.max_freq / 1000 : 'X'; // Set frequency options with default y-scale value.

    $scope.yAxisOptions = [{
      title: '24 kHz scale',
      value: '24_scale',
      active: false
    }, {
      title: 'Original scale (' + $scope.convertedScale + ' kHz)',
      value: 'original_scale',
      active: true
    }]; // Set frequency options with saved frequency.

    if ($scope.scaleCache && !$scope.scaleCache.originalScale && $scope.convertedScale < 24) {
      $scope.deselectFrequencyOptions();
      $scope.yAxisOptions[0].active = true;
    } // Display original frequency for recording whith 24kHz or more.


    if ($scope.convertedScale >= 24) {
      $scope.deselectFrequencyOptions();
      $scope.yAxisOptions[1].active = true;
    }
  };

  $scope.resizeYScale = function (item) {
    $scope.deselectFrequencyOptions();
    item.active = true;
    var originalScale = item.value === 'original_scale';
    $localStorage.setItem('visuilizer.frequencies.cache', JSON.stringify({
      originalScale: originalScale
    }));
    $scope.layout.scale.originalScale = originalScale;
    var span = originalScale ? $scope.visobject.sampling_rate / 2 : 24000;
    $scope.visobject.domain.y.to = span;
    $scope.visobject.domain.y.span = span;
  };

  $scope.audio_player = new a2AudioPlayer($scope, initial_state_params);
  $scope.$on('browser-vobject-type', function (evt, type) {
    $scope.visobject_type = type;
  });
  $scope.$on('browser-available', function () {
    $scope.location.notifyBrowserAvailable();
  });
  $rootScope.$on('notify-visobj-updated', function () {
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift('visobj-updated');
    $scope.$broadcast.apply($scope, args);
  });
  $scope.$on('visobj-updated', function (visobject) {
    $scope.setVisObject($scope.visobject, $scope.visobject_type, $scope.visobject_location);
  });
}]).filter('filterPresentCount', function () {
  return function (validations) {
    if (!validations) return 0;
    var count = 0;
    validations.forEach(function (validation) {
      if (validation.presentReview > 0 || validation.presentAed > 0 || validation.present == 1) {
        count++;
      }
    });
    return count;
  };
}).filter('filterAbsentCount', function () {
  return function (validations) {
    if (!validations) return 0;
    var count = 0;
    validations.forEach(function (validation) {
      if (validation.presentReview == 0 && validation.presentAed == 0 && validation.present == 0) {
        count++;
      }
    });
    return count;
  };
});
/**
 * @ngdoc overview
 * @name a2-visualizer-spectrogram-Layout
 * @description
 * This module stores the layout manager for the spectrogram.
 */

angular.module('a2-visualizer-spectrogram-Layout', ['a2.classy', 'a2-plot-specs']).factory('VisualizerLayoutSpecs', ["PlotSpecs", function (PlotSpecs) {
  return PlotSpecs;
}])
/**
 * @ngdoc service
 * @name a2-visualizer-spectrogram-Layout.factory:VisualizerLayout
 * @description
 * The layout manager for the spectrogram.
 */
.factory('VisualizerLayout', ["a2BrowserMetrics", "makeClass", "VisualizerLayoutSpecs", "$localStorage", function (a2BrowserMetrics, makeClass, VisualizerLayoutSpecs, $localStorage) {
  var align_to_interval = function (unit, domain, align) {
    if (align === undefined || !domain || !domain.unit_interval) {
      return unit;
    } else {
      var f = domain.from || 0,
          u = domain.unit_interval;
      unit = Math.floor((unit - f) / u) * u + f;
      return unit + align * u;
    }
  };

  var get_domain = function (visobject) {
    return visobject && visobject.domain || {
      x: {
        from: 0,
        to: 60,
        span: 60,
        ticks: 60,
        unit: 'Time ( s )'
      },
      y: {
        from: 0,
        to: 22050,
        span: 22050,
        unit: 'Frequency ( kHz )',
        tick_format: function (v) {
          return v / 1000 | 0;
        }
      }
    };
  };

  var make_scale = function (domain, range) {
    var s;

    if (domain.ordinal) {
      var dd = domain.to - domain.from;
      var dr = range[1] - range[0];
      var scale = dr / dd;
      s = d3.scale.linear().domain([domain.from, domain.to]).range([scale / 2 + range[0], range[1] - scale / 2]);
    } else {
      s = d3.scale.linear().domain([domain.from, domain.to]).range(range);
    }

    return s;
  };

  var linear_interpolate = function (x, levels) {
    var l = x * (levels.length - 1);
    var f = Math.floor(l),
        c = Math.ceil(l),
        m = l - f;
    return levels[f] * (1 - m) + levels[c] * m;
  };

  var interpolate = linear_interpolate;
  return makeClass({
    constructor: function () {
      this.scale = {
        def_sec2px: 100 / 1.0,
        def_hz2px: 100 / 5000.0,
        max_sec2px: 100 / (1.0 / 8),
        max_hz2px: 100 / (5000.0 / 8),
        zoom: {
          x: 0,
          y: 0
        },
        sec2px: 100 / 1.0,
        hz2px: 100 / 5000.0,
        originalScale: null
      };
      this.offset = {
        sec: 0,
        hz: 0
      };
      this.tmp = VisualizerLayoutSpecs;
      this.domain = {};
      this.listeners = [];
    },
    x2sec: function (x, interval_align) {
      var seconds = x / this.scale.sec2px;
      seconds += this.offset.sec;
      return align_to_interval(+seconds, this.domain.x, interval_align);
    },
    y2hz: function (y, interval_align) {
      var h = (this.spectrogram && this.spectrogram.height) | 0;
      var hertz = (h - y) / this.scale.hz2px;
      hertz += this.offset.hz;
      return align_to_interval(+hertz, this.domain.y, interval_align);
    },
    sec2x: function (seconds, round, interval_align) {
      seconds = align_to_interval(seconds - this.offset.sec, this.domain.x, interval_align);
      var x = seconds * this.scale.sec2px;
      return round ? x | 0 : +x;
    },
    hz2y: function (hertz, round, interval_align) {
      hertz = align_to_interval(hertz - this.offset.hz, this.domain.y, interval_align);
      var h = (this.spectrogram && this.spectrogram.height) | 0;
      var y = h - hertz * this.scale.hz2px;
      return round ? y | 0 : +y;
    },
    dsec2width: function (seconds1, seconds2, round, inclusive) {
      if (inclusive) {
        seconds1 = align_to_interval(seconds1, this.domain.x, 1);
      }

      var w = (seconds1 - seconds2) * this.scale.sec2px;
      return round ? w | 0 : +w;
    },
    dhz2height: function (hz1, hz2, round, inclusive) {
      if (inclusive) {
        hz1 = align_to_interval(hz1, this.domain.y, 1);
      }

      var h = (hz1 - hz2) * this.scale.hz2px;
      return round ? h | 0 : +h;
    },
    apply: function (container, $scope, width, height, fix_scroll_center) {
      var layout = $scope.visobject && $scope.visobject.layout;
      this.type = layout || 'spectrogram';
      this['apply_' + this.type](container, $scope, width, height, fix_scroll_center);

      for (var eh = this.listeners, ehi = 0, ehe = eh.length; ehi < ehe; ++ehi) {
        eh[ehi](this, container, $scope, width, height, fix_scroll_center);
      }
    },
    apply_spectrogram: function (container, $scope, width, height, fix_scroll_center) {
      var layout_tmp = this.tmp;
      var visobject = $scope.visobject;
      var domain = this.domain = get_domain(visobject);
      var avail_w = width - layout_tmp.axis_sizew - layout_tmp.axis_lead;

      if (domain.legend) {
        avail_w -= layout_tmp.legend_width + layout_tmp.legend_gutter;
      }

      var avail_h = height - layout_tmp.axis_sizeh - layout_tmp.axis_lead - layout_tmp.gutter;
      var cheight = container[0].clientHeight;
      var zoom_levels_x = this.scale.zoom.levelx = [avail_w / domain.x.span, this.scale.max_sec2px];
      var zoom_levels_y = this.scale.zoom.levely = [avail_h / domain.y.span, this.scale.max_hz2px];
      var zoom_sec2px = interpolate(this.scale.zoom.x, zoom_levels_x);
      var zoom_hz2px = interpolate(this.scale.zoom.y, zoom_levels_y);
      var spec_w = Math.max(avail_w, Math.ceil(domain.x.span * zoom_sec2px));
      var spec_h = Math.max(avail_h, Math.ceil(domain.y.span * zoom_hz2px));
      var scalex = make_scale(domain.x, [0, spec_w]);
      var scaley = make_scale(domain.y, [spec_h, 0]);
      var scalelegend;
      var l = this.l = {
        visualizer_root: {
          css: {
            'overflow': ''
          }
        }
      };
      l.spectrogram = {
        css: {
          top: layout_tmp.axis_lead,
          left: layout_tmp.axis_sizew,
          width: spec_w,
          height: spec_h
        }
      };
      l.y_axis = {
        scale: scaley,
        css: {
          top: 0,
          left: container.scrollLeft()
        },
        attr: {
          width: layout_tmp.axis_sizew,
          height: spec_h + layout_tmp.axis_lead + layout_tmp.axis_sizeh
        }
      };
      l.x_axis = {
        scale: scalex,
        css: {
          left: layout_tmp.axis_sizew - layout_tmp.axis_lead,
          // left : layout_tmp.axis_sizew -  layout_tmp.axis_lead,
          top: container.scrollTop() + height - layout_tmp.axis_sizeh - layout_tmp.gutter
        },
        attr: {
          height: layout_tmp.axis_sizeh,
          width: spec_w + 2 * layout_tmp.axis_lead
        }
      };
      this.has_legend = $scope.has_legend = !!domain.legend;

      if (domain.legend) {
        l.legend = {
          scale: scalelegend,
          css: {
            top: 0,
            left: container.scrollLeft() + width - a2BrowserMetrics.scrollSize.width - layout_tmp.legend_width - layout_tmp.legend_gutter
          },
          attr: {
            width: layout_tmp.legend_width,
            height: spec_h + 2 * layout_tmp.axis_lead
          }
        };
        scalelegend = d3.scale.linear().domain([domain.legend.from, domain.legend.to]).range([spec_h - 2, 0]);
      } else {
        l.legend = {};
      } //l.x_axis.attr.height = cheight - l.x_axis.css.top - 1;


      ['spectrogram', 'y_axis', 'x_axis', 'legend'].forEach(function (i) {
        var li = l[i];
        this[i] = li.css;

        if (li.attr) {
          $.extend(this[i], li.attr);
        }

        if (li.scale) {
          this[i].scale = li.scale;
        }
      }.bind(this));
      this.offset.sec = domain.x.from;
      this.offset.hz = domain.y.from;
      this.scale.sec2px = spec_w / domain.x.span;
      this.scale.hz2px = spec_h / domain.y.span;
      this.viewport = {
        left: l.spectrogram.css.left,
        top: l.spectrogram.css.top,
        width: avail_w,
        height: avail_h
      };
      var sh = l.spectrogram.css.height;
      var sw = l.spectrogram.css.width;
      this.root = {
        left: 0,
        top: 0,
        //width  : width,
        //height : height,
        width: width - (avail_h < sh ? a2BrowserMetrics.scrollSize.width : 0),
        height: height - (avail_w < sw ? a2BrowserMetrics.scrollSize.height : 0)
      };
      var scroll_center;

      if (this.center) {
        scroll_center = {
          left: this.scale.sec2px * this.center.s + l.spectrogram.css.left - width / 2.0,
          top: -this.scale.hz2px * this.center.hz - height / 2.0 + l.spectrogram.css.top + l.spectrogram.css.height
        };
      }

      l.domain = domain;
      l.scroll_center = scroll_center;
      l.scale = {
        x: scalex,
        y: scaley,
        legend: scalelegend
      };
    },
    apply_plotted: function (container, $scope, width, height, fix_scroll_center) {
      var layout_tmp = this.tmp;
      var visobject = $scope.visobject;
      var avail_w = width;
      var avail_h = height;
      var cheight = container[0].clientHeight;
      this.has_legend = $scope.has_legend = false;
      var l = this.l = {
        visualizer_root: {
          css: {
            'overflow': 'hidden'
          }
        }
      };
      l.spectrogram = {
        css: {
          top: 0,
          left: 0,
          width: avail_w,
          height: avail_h
        }
      };
      l.scroll_center = {
        left: 0,
        top: 0
      };
      this.spectrogram = l.spectrogram.css;
      this.viewport = angular.extend(l.spectrogram.css);
      this.root = {
        left: 0,
        top: 0,
        width: width,
        height: height
      };
    }
  });
}]);
angular.module('a2-visualizer-spectrogram-click2zoom', ['a2.classy']).service('a2SpectrogramClick2Zoom', ["makeClass", "a22PointBBoxEditor", function (makeClass, a22PointBBoxEditor) {
  return makeClass({
    super: a22PointBBoxEditor.prototype,
    toggle_active: function () {
      this.active = !this.active;

      if (this.active) {
        this.reset();
      }
    },
    constructor: function (layout) {
      this.super.constructor.call(this);
      this.layout = layout;
      this.active = false;
    },
    add_point: function (x, y, zoom) {
      this.super.add_point.call(this, x, y);

      if (zoom) {
        this.zoom();
      }
    },
    zoom_out: function () {
      var layout = this.layout;
      this.active = false;
      layout.scale.zoom.x = Math.max(0, layout.scale.zoom.x - 0.1);
      layout.scale.zoom.y = Math.max(0, layout.scale.zoom.y - 0.1);
    },
    zoom_reset: function () {
      var layout = this.layout;
      this.active = false;
      layout.scale.zoom.x = 0;
      layout.scale.zoom.y = 0;
    },
    zoom: function () {
      var layout = this.layout;
      var bbox = this.bbox;
      var dx = bbox.x2 - bbox.x1,
          dy = bbox.y2 - bbox.y1;
      var cp = [(bbox.x2 + bbox.x1) / 2, (bbox.y2 + bbox.y1) / 2];
      var avail_h = layout.viewport.height;
      var avail_w = layout.viewport.width;
      var lzoom = layout.scale.zoom;
      var zoom_x = avail_w / dx,
          zoom_y = avail_h / dy;
      var zoom_level_x = Math.max(0, Math.min((zoom_x - lzoom.levelx[0]) / (lzoom.levelx[1] - lzoom.levelx[0]), 1));
      var zoom_level_y = Math.max(0, Math.min((zoom_y - lzoom.levely[0]) / (lzoom.levely[1] - lzoom.levely[0]), 1));
      this.active = false;
      layout.center = {
        s: cp[0],
        hz: cp[1]
      };
      layout.scale.zoom.x = zoom_level_x;
      layout.scale.zoom.y = zoom_level_y;
      console.log("zoom :: ", [dx, dy], cp, [zoom_level_x, zoom_level_y]);
    }
  });
}]).directive('a2ZoomControl', function () {
  return {
    restrict: 'E',
    scope: {
      'level': '='
    },
    templateUrl: '/directives/zoom-ctrl.html',
    replace: true,
    link: function ($scope, $element, $attrs) {
      var delta = +$attrs.delta || 0.1;
      var horizontal = !!($attrs.horizontal | 0 || /on|yes|true/.test($attrs.horizontal + ''));
      $scope.horizontal = horizontal;
      $scope.switched = horizontal;

      $scope.step = function (step) {
        $scope.level = Math.min(1, Math.max($scope.level + step * delta, 0));
      };

      $scope.set_by_mouse = function ($event) {
        var track = $element.find('.zoom-track'),
            trackpos = track.offset();
        var px = (track.width() - ($event.pageX - trackpos.left)) / track.width();
        var py = (track.height() - ($event.pageY - trackpos.top)) / track.height(); // console.log('$scope.set_by_mouse', [px,py]);

        var level = $scope.horizontal ? px : py;
        $scope.level = $scope.switched ? 1 - level : level;
      };
    }
  };
});
/**
 * @ngdoc overview
 * @name a2-sidenav
 * @description
 * Directive for specifying a sidenav bar.
 * this bar specifies a list of links that can be added
 * whenever a corresponding sidenavbar anchor resides
 */
angular.module('a2.directive.audio-bar', ['a2.utils', 'a2.srv.local-storage', 'a2.visualizer.audio-player']).directive('a2AudioBar', ["a2SidenavBarService", "$parse", function (a2SidenavBarService, $parse) {
  return {
    restrict: 'E',
    templateUrl: '/directives/a2-audio-bar/a2-audio-bar.html',
    scope: {},
    replace: true,
    controller: 'a2AudioBarCtrl as controller'
  };
}]).factory('a2AudioBarService', ["$rootScope", function ($rootScope) {
  return {
    loadUrl: function (url, play) {
      $rootScope.$broadcast('a2-audio-load-url', {
        url: url,
        play: play
      });
    }
  };
}]).controller('a2AudioBarCtrl', ["$scope", "$filter", "a2AudioPlayer", "$timeout", "$q", "$localStorage", function ($scope, $filter, a2AudioPlayer, $timeout, $q, $localStorage) {
  Object.assign(this, {
    initialize: function () {
      this.audio_player = new a2AudioPlayer($scope);
      this.expanded = false;
      this.collapseTimeoutInterval = 6000;
      this.loading = false;
      this.audio_player.setGain($localStorage.getItem('a2-audio-param-gain') || 1);
      this.deregHandlers = [];
      this.deregHandlers.push($scope.$on('a2-audio-load-url', this.onLoadUrl.bind(this)));
      this.deregHandlers.push($scope.$on('$destroy', this.onDestroy.bind(this)));
    },
    onLoadUrl: function (event, options) {
      this.loadUrl(options);
    },
    onDestroy: function () {
      (this.deregHandlers || []).forEach(function (fn) {
        fn();
      });
    },
    setCollapseTimer: function () {
      if (this.collapseTimer) {
        $timeout.cancel(this.collapseTimer);
      }

      if (this.collapseTimeoutInterval) {
        this.collapseTimer = $timeout(function () {
          this.expanded = false;
        }.bind(this), this.collapseTimeoutInterval);
      }
    },
    seekPercent: function (percent) {
      return this.audio_player.setCurrentTime(percent * this.audio_player.resource.duration);
    },
    setGain: function (gain) {
      this.setCollapseTimer();
      $localStorage.setItem('a2-audio-param-gain', gain);
      return this.audio_player.setGain(gain);
    },
    play: function () {
      this.setCollapseTimer();
      return this.audio_player.play();
    },
    pause: function () {
      this.setCollapseTimer();
      return this.audio_player.pause();
    },
    stop: function () {
      this.setCollapseTimer();
      return this.audio_player.stop();
    },
    toggleExpanded: function () {
      this.expanded = !this.expanded;

      if (this.expanded) {
        this.setCollapseTimer();
      }
    },
    loadUrl: function (options) {
      options = options || {};
      const url = options.url;
      const play = options.play || options.play === undefined;

      if (!url) {
        return $q.resolve();
      }

      this.loading = true;
      this.expanded = true;
      return this.audio_player.load(url).then(function () {
        this.loading = false;

        if (play) {
          return this.play();
        }
      }.bind(this)).catch(function (e) {
        this.loading = false;
        this.error = e;
        console.error(e);
      }.bind(this));
    }
  });
  this.initialize(this);
}]);
angular.module('arbimon.directive.a2-switch', []).directive('a2Switch', function () {
  return {
    restict: 'E',
    templateUrl: '/directives/a2-switch/template.html',
    require: 'ngModel',
    scope: {
      onText: '@',
      offText: '@',
      disabled: '='
    },
    link: function (scope, element, attrs, ngModelCtrl) {
      scope.toggle = function (event) {
        scope.value = !scope.value;
        ngModelCtrl.$setViewValue(scope.value, event && event.type);
      };

      ngModelCtrl.$render = function () {
        scope.value = !!ngModelCtrl.$viewValue;
      };
    }
  };
});
angular.module('a2.utils.facebook-login-button', ['a2.utils', 'a2.utils.global-anonymous-function', 'a2.utils.external-api-loader', 'a2.injected.data']).config(["externalApiLoaderProvider", function (externalApiLoaderProvider) {
  externalApiLoaderProvider.addApi('facebook', {
    url: "//connect.facebook.net/en_US/sdk.js",
    namespace: 'FB',
    onload: ["a2InjectedData", function (a2InjectedData) {
      this.module.init(a2InjectedData.facebook_api);
    }]
  });
}]).directive('a2FacebookLoginButton', ["$window", "$q", "$timeout", "a2InjectedData", "externalApiLoader", function ($window, $q, $timeout, a2InjectedData, externalApiLoader) {
  return {
    restrict: 'E',
    templateUrl: '/directives/external/facebook-login-button.html',
    scope: {
      onSignedIn: '&?',
      onError: '&?'
    },
    link: function (scope, element, attrs) {
      element.children('.btn-facebook-login').addClass(element[0].className);
      element[0].className = '';

      scope.signIn = function () {
        externalApiLoader.load('facebook').then(function (FB) {
          FB.login(function (response) {
            if (response.status === 'connected') {
              console.log(response);
              scope.onSignedIn({
                user: response
              });
            } else if (response.status === 'not_authorized') {} else {}
          }, {
            scope: 'public_profile,email'
          });
        });
      };
    }
  };
}]);
angular.module('a2.utils.google-login-button', ['a2.utils', 'a2.utils.q-promisify', 'a2.utils.global-anonymous-function', 'a2.utils.external-api-loader', 'a2.injected.data']).config(["externalApiLoaderProvider", function (externalApiLoaderProvider) {
  externalApiLoaderProvider.addApi('google-api', {
    url: "https://apis.google.com/js/client.js",
    namespace: 'gapi',
    jsonpCallback: 'onload'
  });
  externalApiLoaderProvider.addApi('google-api/auth2', {
    parent: 'google-api',
    loader: ["$qPromisify", function ($qPromisify) {
      return $qPromisify.invoke(this.parent.module, 'load', 'auth2');
    }],
    onload: ["a2InjectedData", function (a2InjectedData) {
      var auth2 = this.module.init({
        client_id: a2InjectedData.google_oauth_client,
        cookiepolicy: 'single_host_origin'
      });
      return auth2.then(function () {
        this.module.auth2 = auth2;
      }.bind(this));
    }],
    getCachedModule: function () {
      return this.parent && this.parent.module && this.parent.module.auth2;
    }
  });
}]).directive('a2GoogleLoginButton', ["$window", "$q", "$timeout", "globalAnonymousFunction", "a2InjectedData", "externalApiLoader", function ($window, $q, $timeout, globalAnonymousFunction, a2InjectedData, externalApiLoader) {
  return {
    restrict: 'E',
    templateUrl: '/directives/external/google-login-button.html',
    scope: {
      onSignedIn: '&?',
      onError: '&?'
    },
    link: function (scope, element, attrs) {
      element.children('.btn-google-login').addClass(element[0].className);
      element[0].className = '';

      scope.signIn = function () {
        externalApiLoader.load('google-api/auth2').then(function (auth2) {
          auth2.auth2.signIn().then(function (user) {
            scope.onSignedIn({
              user: user
            });
          }, function (error) {
            scope.onError({
              error: error
            });
          });
        });
      };
    }
  };
}]);
angular.module('a2.analysis.audio-event-detection', ['a2.filter.as-csv', 'a2.filter.time-from-now', 'a2.srv.resolve', 'a2.srv.open-modal', 'a2.service.audio-event-detection', 'a2.analysis.audio-event-detection.new-modal']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('analysis.audio-event-detection', {
    url: '/audio-event-detection',
    controller: 'AudioEventDetectionAnalysisStateCtrl as controller',
    templateUrl: '/app/analysis/audio-event-detection/index.html'
  });
}]).controller('AudioEventDetectionAnalysisStateCtrl', ["$q", "$promisedResolve", "$openModal", "a2UserPermit", function ($q, $promisedResolve, $openModal, a2UserPermit) {
  this.initialize = function () {
    return this.reload();
  };

  this.reload = function () {
    this.loading = true;
    return $promisedResolve({
      audioEventDetectionsList: ["AudioEventDetectionService", function (AudioEventDetectionService) {
        return AudioEventDetectionService.getList();
      }]
    }, this).then(function () {
      this.loading = false;
    }.bind(this));
  };

  this.new = function () {
    if (!a2UserPermit.can('manage soundscapes')) {
      notify.error('You do not have permission to create audio event detections.');
      return;
    }

    return $openModal('audio-event-detection.new-modal', {
      resolve: {
        onSubmit: ["AudioEventDetectionService", function (AudioEventDetectionService) {
          return AudioEventDetectionService.new;
        }]
      }
    });
  };

  this.initialize();
}]);
angular.module('a2.analysis.audio-event-detection.new-modal', ['a2.srv.open-modal', 'a2.srv.resolve', 'a2.srv.playlists', 'humane', 'a2.directive.require-non-empty', 'a2.service.audio-event-detection']).config(["$openModalProvider", function ($openModalProvider) {
  $openModalProvider.define('audio-event-detection.new-modal', {
    templateUrl: '/app/analysis/audio-event-detection/new-modal.html',
    controllerAs: 'controller',
    controller: 'NewAudioEventDetectionModalCtrl',
    resolve: {
      onSubmit: function () {
        return null;
      }
    }
  });
}]).constant('AudioEventDetectionParametersEditTemplateUrls', {
  fltr: '/app/analysis/audio-event-detection/algorithm-fltr-edit-parameters.html'
}).controller('NewAudioEventDetectionModalCtrl', ["$q", "$modalInstance", "$promisedResolve", "$parse", "notify", "AudioEventDetectionParametersEditTemplateUrls", "onSubmit", function ($q, $modalInstance, $promisedResolve, $parse, notify, AudioEventDetectionParametersEditTemplateUrls, onSubmit) {
  this.playlists = [];
  this.algorithmsList = [];
  this.statisticsList = [];
  var getDefaultName = $parse("[" + "(playlist.name || '[Playlist]'), " + "(algorithm.name || '[Algorithm]'), " + "(parameters ? '(' + (parameters  | asCSV) + ')' : ''), " + "(date | moment:'ll')" + "] | asCSV:' / '");

  this.initialize = function () {
    return this.reload().then(function () {
      this.aed = {
        algorithm: this.algorithmsList[0],
        statistics: this.statisticsList.slice(),
        playlist: null,
        date: new Date()
      };
      this.notifyAedAlgorithmChanged();
    }.bind(this));
  };

  this.reload = function () {
    this.loading = true;
    return $promisedResolve({
      playlists: ["a2Playlists", function (a2Playlists) {
        return a2Playlists.getList();
      }],
      algorithmsList: function (AudioEventDetectionService) {
        return AudioEventDetectionService.getAlgorithmsList();
      },
      statisticsList: function (AudioEventDetectionService) {
        return AudioEventDetectionService.getStatisticsList();
      }
    }, this).then(function () {
      this.loading = false;
    }.bind(this));
  };

  this.notifyAedAlgorithmChanged = function () {
    var algorithm = this.aed.algorithm || {};
    this.aed.parameters = algorithm.defaults || {};
    this.algorithmParametersTemplate = AudioEventDetectionParametersEditTemplateUrls[algorithm.name];
    this.recomputeDefaultName();
  };

  this.recomputeDefaultName = function () {
    this.aed.defaultName = getDefaultName(this.aed);
  };

  this.ok = function () {
    return $q.resolve().then(function () {
      return onSubmit && onSubmit(this.aed);
    }.bind(this)).then(function () {
      return $modalInstance.close(this.aed);
    }.bind(this)).catch(function (error) {
      notify.error(error);
    });
  };

  this.cancel = function () {
    $modalInstance.dismiss('cancel');
  };

  this.initialize();
}]);
angular.module('a2.analysis.audio-event-detections-clustering', ['ui.bootstrap', 'a2.srv.audio-event-detections-clustering', 'a2.services', 'a2.permissions', 'humane', 'a2.directive.error-message']).config(["$stateProvider", function ($stateProvider) {
  $stateProvider.state('analysis.audio-event-detections-clustering', {
    url: '/audio-event-detections-clustering?newJob',
    controller: 'AudioEventDetectionsClusteringModelCtrl',
    templateUrl: '/app/analysis/audio-event-detections-clustering/list.html'
  });
}]).controller('AudioEventDetectionsClusteringModelCtrl', ["$scope", "$modal", "$location", "JobsData", "notify", "a2AudioEventDetectionsClustering", "Project", "$localStorage", "$window", "a2UserPermit", "$state", function ($scope, $modal, $location, JobsData, notify, a2AudioEventDetectionsClustering, Project, $localStorage, $window, a2UserPermit, $state) {
  var p = $state.params;
  var isNewJob = p && p.newJob !== undefined;

  $scope.loadAudioEventDetections = function () {
    $scope.loading = true;
    $scope.showRefreshBtn = false;
    $scope.projectUrl = Project.getUrl();
    return a2AudioEventDetectionsClustering.list({
      user: true,
      dataExtended: true,
      completed: true,
      aedCount: true
    }).then(function (data) {
      $scope.audioEventDetectionsOriginal = data;
      $scope.audioEventDetectionsData = data;
      $scope.loading = false;

      if (data && data.length) {
        $scope.showRefreshBtn = true;
      }
    });
  };

  $scope.loadAudioEventDetections();

  $scope.onSelectedJob = function (playlist_id, job_id, first_playlist_recording) {
    $localStorage.setItem('analysis.audioEventJob', job_id);
    $window.location.href = '/project/' + Project.getUrl() + '/visualizer/playlist/' + playlist_id + '/' + first_playlist_recording;
  };

  $scope.createNewClusteringModel = function () {
    if (!a2UserPermit.can('manage AED and Clustering job')) {
      notify.error('You do not have permission to create <br> Audio Event Detection job');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/audio-event-detections-clustering/new-audio-event-detection-clustering.html',
      controller: 'CreateNewAudioEventDetectionClusteringCtrl as controller'
    });
    modalInstance.result.then(function (result) {
      data = result;

      if (data.create) {
        JobsData.updateJobs();
        $scope.showRefreshBtn = true;
        notify.log("Your new Audio Event Detection Clustering model is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
      } else if (data.error) {
        notify.error("Error: " + data.error);
      } else if (data.url) {
        $location.path(data.url);
      }
    });
  };

  if (isNewJob) {
    $scope.createNewClusteringModel();
  }

  $scope.deleteAedJob = function (aedJob, $event) {
    $event.stopPropagation();

    if (!a2UserPermit.can('manage AED and Clustering job')) {
      notify.error('You do not have permission to delete <br> Audio Event Detection job');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/audio-event-detections-clustering/delete-audio-event-detection-clustering-job.html',
      controller: 'DeleteAedJobCtrl as controller',
      resolve: {
        aedJob: function () {
          return aedJob;
        }
      }
    });
    modalInstance.result.then(function (ret) {
      if (ret.err) {
        notify.error('Error: ' + ret.err);
      } else {
        const modArr = angular.copy($scope.audioEventDetectionsOriginal);
        const indx = modArr.findIndex(function (item) {
          return item.job_id === aedJob.job_id;
        });

        if (indx > -1) {
          $scope.audioEventDetectionsOriginal.splice(indx, 1);
          notify.log('Audio Event Detection Job deleted successfully');
        }
      }
    });
  };
}]).controller('DeleteAedJobCtrl', ["$scope", "$modalInstance", "a2AudioEventDetectionsClustering", "aedJob", function ($scope, $modalInstance, a2AudioEventDetectionsClustering, aedJob) {
  this.aedJob = aedJob;
  $scope.deletingloader = false;

  $scope.ok = function () {
    $scope.deletingloader = true;
    a2AudioEventDetectionsClustering.delete(aedJob.job_id).then(function (data) {
      $modalInstance.close(data);
    });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]).controller('CreateNewAudioEventDetectionClusteringCtrl', ["$modalInstance", "a2AudioEventDetectionsClustering", "a2Playlists", "a2UserPermit", "notify", function ($modalInstance, a2AudioEventDetectionsClustering, a2Playlists, a2UserPermit, notify) {
  Object.assign(this, {
    initialize: function () {
      this.loading = {
        playlists: false
      };
      this.details = {
        show: false
      };
      var list = this.list = {};
      this.data = {
        name: null,
        playlist: null,
        params: {
          areaThreshold: 1,
          amplitudeThreshold: 1,
          durationThreshold: 0.2,
          bandwidthThreshold: 0.5,
          filterSize: 10,
          minFrequency: 0,
          maxFrequency: 24
        }
      };
      this.isRfcxUser = a2UserPermit.isRfcx();
      this.isSuper = a2UserPermit.isSuper();
      this.errorJobLimit = false;
      this.loading.playlists = true;
      a2Playlists.getList().then(function (playlists) {
        this.loading.playlists = false;
        list.playlists = playlists;
      }.bind(this));
    },
    isRfcx: function () {
      return this.isRfcxUser || this.isSuper;
    },
    checkLimit: function (count) {
      return count > 10000 && !this.isRfcx();
    },
    toggleDetails: function () {
      this.details.show = !this.details.show;
    },
    newJob: function () {
      try {
        return a2AudioEventDetectionsClustering.create({
          playlist_id: this.data.playlist.id,
          name: this.data.name,
          params: this.data.params
        }).then(function (clusteringModel) {
          $modalInstance.close({
            create: true,
            clusteringModel: clusteringModel
          });
        }).catch(notify.serverError);
      } catch (error) {
        console.error('a2AudioEventDetectionsClustering.create error: ' + error);
      }
    },
    create: function () {
      var _this = this;

      this.errorJobLimit = false;
      if (this.isRfcx()) return this.newJob();
      return a2AudioEventDetectionsClustering.count().then(function (data) {
        if (_this.checkLimit(data.totalRecordings)) {
          _this.errorJobLimit = true;
          return;
        } else _this.newJob();
      });
    },
    cancel: function (url) {
      $modalInstance.close({
        cancel: true,
        url: url
      });
    },
    isJobValid: function () {
      return this.data && this.data.name && this.data.name.length > 3 && this.data.playlist && !this.isNotDefined(this.data.params.maxFrequency) && !this.isNotDefined(this.data.params.minFrequency);
    },
    showNameWarning: function () {
      return this.data && this.data.name && this.data.name.length > 1 && this.data.name.length < 4;
    },
    showPlaylistLimitWarning: function () {
      if (!this.data && !this.data.playlist) return;
      return this.data && this.data.playlist && this.data.playlist.count > 2000 && !this.isRfcx();
    },
    showFrequencyWarning: function () {
      return this.data.params.maxFrequency <= this.data.params.minFrequency;
    },
    isNotDefined: function (item) {
      return item === undefined || item === null;
    }
  });
  this.initialize();
}]);
angular.module('a2.analysis.clustering-jobs', ['ui.bootstrap', 'a2.srv.clustering-jobs', 'a2.srv.playlists', 'a2.services', 'a2.permissions', 'a2.directive.audio-bar', 'humane', 'a2.filter.round', 'a2.directive.frequency_filter_range_control']).config(["$stateProvider", function ($stateProvider) {
  $stateProvider.state('analysis.clustering-jobs', {
    url: '/clustering-jobs',
    controller: 'ClusteringJobsModelCtrl',
    templateUrl: '/app/analysis/clustering-jobs/list.html'
  }).state('analysis.clustering-jobs-details', {
    url: '/clustering-jobs/:clusteringJobId?freqMin&freqMax',
    controller: 'ClusteringJobsModelCtrl',
    params: {
      freqMin: null,
      freqMax: null
    },
    templateUrl: '/app/analysis/clustering-jobs/list.html'
  }).state('analysis.grid-view', {
    url: '/clustering-jobs/:clusteringJobId/grid-view',
    controller: 'ClusteringJobsModelCtrl',
    params: {
      gridContext: null
    },
    templateUrl: '/app/analysis/clustering-jobs/list.html'
  });
}]) //------------------- Clustering List page ---------------
.controller('ClusteringJobsModelCtrl', ["$scope", "$state", "$stateParams", "a2ClusteringJobs", "JobsData", "notify", "$location", "$modal", "a2UserPermit", "$localStorage", "Project", function ($scope, $state, $stateParams, a2ClusteringJobs, JobsData, notify, $location, $modal, a2UserPermit, $localStorage, Project) {
  $scope.selectedClusteringJobId = $stateParams.clusteringJobId;
  $scope.showViewGridPage = false;
  $scope.getProjectData = function () {
    Project.getInfo(function (info) {
      $scope.isProjectDisabled = info.disabled === 1;
    });
  }, $scope.getProjectData();

  $scope.loadClusteringJobs = function () {
    $scope.loading = true;
    $scope.showRefreshBtn = false;
    return a2ClusteringJobs.list({
      completed: true
    }).then(function (data) {
      $scope.clusteringJobsOriginal = data;
      $scope.clusteringJobsData = data;
      $scope.loading = false;

      if (data && data.length) {
        $scope.showRefreshBtn = true;
      }
    });
  };

  if (!$scope.selectedClusteringJobId) {
    $scope.loadClusteringJobs();
  } // Parse grid view data if it exists


  const gridContext = JSON.parse($localStorage.getItem('analysis.gridContext'));

  if ($stateParams.gridContext || gridContext && $state.current.name === 'analysis.grid-view') {
    $scope.showViewGridPage = true;
    $scope.gridContext = $stateParams.gridContext ? $stateParams.gridContext : gridContext;
  } else {
    $localStorage.setItem('analysis.gridContext', null);
  }

  $scope.selectItem = function (clusteringJob) {
    if (!clusteringJob) {
      $state.go('analysis.clustering-jobs', {});
    } else {
      $state.go('analysis.clustering-jobs-details', {
        clusteringJobId: clusteringJob.clustering_job_id
      });
    }
  };

  $scope.createNewClusteringJob = function () {
    if (!a2UserPermit.can('manage AED and Clustering job')) {
      notify.error('You do not have permission to create Clustering job');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/clustering-jobs/new-clustering-job.html',
      controller: 'CreateNewClusteringJobCtrl as controller'
    });
    modalInstance.result.then(function (result) {
      data = result;

      if (data.create) {
        JobsData.updateJobs();
        $scope.showRefreshBtn = true;
        notify.log("Your new clustering job is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
      } else if (data.error) {
        notify.error("Error: " + data.error);
      } else if (data.url) {
        $location.path(data.url);
      }
    });
  };

  $scope.deleteClusteringJob = function (clusteringJob, $event) {
    $event.stopPropagation();

    if (!a2UserPermit.can('manage AED and Clustering job')) {
      notify.log('You do not have permission to delete Clustering job');
      return;
    }

    const modalInstance = $modal.open({
      templateUrl: '/app/analysis/clustering-jobs/delete-clustering-job.html',
      controller: 'DeleteClusteringJobCtrl as controller',
      resolve: {
        clusteringJob: function () {
          return clusteringJob;
        }
      }
    });
    modalInstance.result.then(function (ret) {
      if (ret.err) {
        notify.error('Error: ' + ret.err);
      } else {
        const modArr = angular.copy($scope.clusteringJobsOriginal);
        const indx = modArr.findIndex(function (item) {
          return item.clustering_job_id === clusteringJob.clustering_job_id;
        });

        if (indx > -1) {
          $scope.clusteringJobsOriginal.splice(indx, 1);
          notify.log('Clustering Job deleted successfully');
        }
      }
    });
  };
}]).controller('DeleteClusteringJobCtrl', ["$scope", "$modalInstance", "a2ClusteringJobs", "clusteringJob", function ($scope, $modalInstance, a2ClusteringJobs, clusteringJob) {
  this.clusteringJob = clusteringJob;
  $scope.deletingloader = false;

  $scope.ok = function () {
    $scope.deletingloader = true;
    a2ClusteringJobs.delete(clusteringJob.clustering_job_id).then(function (data) {
      $modalInstance.close(data);
    });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]) //------------------- Clustering Details page ---------------
.directive('a2ClusteringDetails', function () {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      clusteringJobId: '=',
      detailedView: '=',
      onSetDetailedView: '&',
      onGoBack: '&'
    },
    controller: 'ClusteringDetailsCtrl',
    controllerAs: 'controller',
    templateUrl: '/app/analysis/clustering-jobs/details.html'
  };
}).controller('ClusteringDetailsCtrl', ["$scope", "$state", "$location", "a2ClusteringJobs", "$window", "Project", "a2Playlists", "$localStorage", "$modal", "a2UserPermit", function ($scope, $state, $location, a2ClusteringJobs, $window, Project, a2Playlists, $localStorage, $modal, a2UserPermit) {
  var d3 = $window.d3;
  $scope.loading = true;
  $scope.toggleMenu = false;
  $scope.selectedCluster = null;
  var timeout;
  $scope.frequencyFilter = {
    min: null,
    max: null,
    currentMin: null,
    currentMax: null
  };

  $scope.decrementClusters = function () {
    if ($scope.selectedCluster === 1) return;
    $scope.selectedCluster -= 1;
    $scope.selectCluster();
  };

  $scope.incrementClusters = function () {
    if ($scope.selectedCluster === $scope.layout.shapes.length) return;
    $scope.selectedCluster += 1;
    $scope.selectCluster();
  }; // Select one cluster


  $scope.selectCluster = function () {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      if ($scope.selectedCluster !== null) {
        $("#plotly .select-outline").remove();
        $scope.layout.shapes.forEach(function (shape) {
          shape.line.color = shape.fillcolor;
          shape.line['stroke-width'] = 1;
        });
        var selection = $scope.layout.shapes[$scope.selectedCluster - 1];
        selection.line.color = '#ffffff';
        Plotly.relayout(document.getElementById('plotly'), {
          'selection.line.color': '#ff0000',
          'selection.line.opacity': 1,
          'selection.line.stroke-width': 4
        }); // Example: 3:[0, 1, 2, 3, 4] , where 3 - index of a cluster, array with the index of detections

        $scope.points = [];
        $scope.points[$scope.selectedCluster - 1] = [];
        $scope.points[$scope.selectedCluster - 1] = $scope.getShapePoints();
        $scope.toggleMenu = true;
        $scope.$apply();
      }
    }, 2000);
  };

  $scope.getShapePoints = function () {
    var arr = [];
    var clusters = $scope.isFilteredClusters() ? $scope.sortFilteredData({
      min: $location.search().freqMin,
      max: $location.search().freqMax
    }) : $scope.clusters;
    var selectedAedList = Object.values(clusters)[$scope.selectedCluster - 1].aed;

    if (selectedAedList && selectedAedList.length) {
      selectedAedList.forEach(function (item, ind) {
        arr.push(ind);
      });
    }

    return arr;
  };

  var getClusteringDetails = function () {
    $scope.infopanedata = '';
    a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function (data) {
      if (data) $scope.job_details = data;
    }).catch(function (err) {
      console.log(err);
    }); // Get json file which is included aed_id, clusters names, x, y points.

    a2ClusteringJobs.getClusteringDetails({
      job_id: $scope.clusteringJobId
    }).then(function (res) {
      $scope.loading = false;

      if (res && res.aed_id) {
        $scope.countAudioEventDetected = res.aed_id.length; // Collect clusters data.

        $scope.clusters = {};
        res.cluster.forEach(function (item, i) {
          if (!$scope.clusters[item]) {
            $scope.clusters[item] = {
              x: [res.x_coord[i]],
              y: [res.y_coord[i]],
              aed: [res.aed_id[i]],
              freq_low: [],
              freq_high: []
            };
          } else {
            $scope.clusters[item].x.push(res.x_coord[i]);
            $scope.clusters[item].y.push(res.y_coord[i]);
            $scope.clusters[item].aed.push(res.aed_id[i]);
          }
        }); // Get json file which is included aed_id, recordings, frequency data for the frequency filter.

        a2ClusteringJobs.getClusteringDetails({
          job_id: $scope.clusteringJobId,
          aed_info: true
        }).then(function (data) {
          if (data !== undefined) {
            $scope.aedDataInfo = data; // Create frequency object to collect min and max values for the frequency filter.

            $scope.frequency = {
              freq_low: [],
              freq_high: []
            }; // Add frequency min, max values to the clusters array.

            for (var c in $scope.clusters) {
              if ($scope.clusters[c] && $scope.clusters[c].aed && $scope.clusters[c].aed.length) {
                $scope.clusters[c].aed.forEach(function (aed) {
                  const indx = data.aed_id.findIndex(function (item) {
                    return item === aed;
                  });

                  if (indx !== -1) {
                    // Collect frequency min and max values for the frequency filter.
                    $scope.frequency.freq_low.push(data.freq_low[indx]);
                    $scope.frequency.freq_high.push(data.freq_high[indx]);
                    $scope.clusters[c].freq_low.push(data.freq_low[indx]);
                    $scope.clusters[c].freq_high.push(data.freq_high[indx]);
                  }
                });
              }
            } // Find frequency min and max values for frequency filter.


            $scope.frequencyFilter.min = Math.min.apply(null, $scope.frequency.freq_low);
            $scope.frequencyFilter.max = Math.max.apply(null, $scope.frequency.freq_high);

            if ($scope.isFilteredClusters()) {
              $scope.useFrequencyFilterData({
                min: parseInt($location.search().freqMin),
                max: parseInt($location.search().freqMax)
              });
            }
          }
        }).catch(function (err) {
          console.log(err);
        });
        $scope.countClustersDetected = Object.keys($scope.clusters).length;

        if (!$scope.isFilteredClusters()) {
          drawClusteringPoints($scope.clusters);
        }
      }
    }).catch(function (err) {
      console.log(err);
      $scope.loading = false;
      $scope.infopanedata = 'No data for clustering job found.';
    });
  };

  $scope.isFilteredClusters = function () {
    return $location.search().freqMin && $location.search().freqMax;
  };

  $scope.isEmpty = function () {
    return $scope.countAudioEventDetected !== undefined && $scope.countAudioEventDetected === 0 && !$scope.loading;
  };

  $scope.aedsDetected = function () {
    if ($scope.countAudioEventDetected === undefined && $scope.loading) return '';
    if ($scope.countAudioEventDetected === undefined && !$scope.loading) return 'no data';
    return $scope.countAudioEventDetected;
  };

  $scope.clustersDetected = function () {
    if ($scope.countClustersDetected === undefined && $scope.loading) return '';
    if ($scope.countClustersDetected === undefined && !$scope.loading) return 'no data';
    return $scope.countClustersDetected;
  };

  var drawClusteringPoints = function (clusters) {
    var el = document.getElementById('plotly');
    var data = [];
    var shapes = [];
    $scope.originalData = [];

    for (var c in clusters) {
      // Collect data for points.
      data.push({
        x: clusters[c].x,
        y: clusters[c].y,
        type: 'scatter',
        mode: 'markers',
        hoverinfo: 'none',
        name: c,
        marker: {
          size: 6
        }
      }); // Collect data for shapes.

      shapes.push({
        type: 'circle',
        xref: 'x',
        yref: 'y',
        x0: d3.min(clusters[c].x),
        y0: d3.min(clusters[c].y),
        x1: d3.max(clusters[c].x),
        y1: d3.max(clusters[c].y),
        opacity: 0.2
      }); // Collect data for grid view page.

      $scope.originalData.push({
        x: clusters[c].x,
        y: clusters[c].y,
        cluster: c,
        aed: clusters[c].aed
      });
    } // Shapes layout.


    $scope.layout = {
      shapes: shapes,
      height: el ? el.offsetWidth - el.offsetWidth / 3 : 800,
      width: el ? el.offsetWidth : 1390,
      showlegend: true,
      dragmode: 'lasso',
      legend: {
        title: {
          text: 'Clusters names',
          side: 'top',
          font: {
            size: 12
          }
        },
        x: 1,
        xanchor: 'right',
        y: 1,
        itemclick: 'toggleothers',
        font: {
          color: 'white'
        }
      },
      paper_bgcolor: '#232436',
      plot_bgcolor: '#232436',
      xaxis: {
        color: 'white',
        title: 'Component 2',
        side: 'top'
      },
      yaxis: {
        color: 'white',
        title: 'Component 1'
      }
    }; // Function to get color.

    function getColor(n) {
      const rgb = [0, 0, 0];

      for (var i = 0; i < 24; i++) {
        rgb[i % 3] <<= 1;
        rgb[i % 3] |= n & 0x01;
        n >>= 1;
      }

      return '#' + rgb.reduce(function (a, c) {
        return (c > 0x0f ? c.toString(16) : '0' + c.toString(16)) + a;
      }, '');
    } // Make random color for shapes and points.


    $scope.layout.shapes.forEach(function (shape, i) {
      var color = getColor(i + 1);
      data[i].marker = {
        color: color
      };
      shape.fillcolor = color;
      shape.line = {
        color: color,
        'stroke-width': 1
      };
    });

    $scope.resetSelect = function () {
      $scope.toggleMenu = false;
      $scope.$apply();
      $scope.layout.shapes.forEach(function (shape) {
        shape.line.color = shape.fillcolor;
        shape.line['stroke-width'] = 1;
      });
      Plotly.redraw(el);
      $scope.$apply();
    };

    if (el) {
      var config = {
        scrollZoom: true,
        displayModeBar: true,
        displaylogo: false,
        hoverdistance: 5
      }; // To draw points

      Plotly.newPlot(el, data, $scope.layout, config);
      dragLayer = document.getElementsByClassName('nsewdrag')[0];
      $scope.xAxisRangeStart = $scope.layout.xaxis.range[0]; // Hover on plotly

      el.on('plotly_hover', function (data) {
        if ($scope.layout.dragmode === 'lasso') {
          dragLayer.classList.add('lasso-cursor');
        }
      }); // Zoom on plotly

      el.on('plotly_unhover', function (data) {
        dragLayer.classList.remove('lasso-cursor');
      });
      el.on('plotly_relayouting', function (data) {
        if (data['xaxis.range[0]'] > $scope.xAxisRangeStart) {
          dragLayer.classList.remove('zoom-out-cursor');
          dragLayer.classList.add('zoom-in-cursor');
          $scope.xAxisRangeStart = data['xaxis.range[0]'];
        }

        if (data['xaxis.range[0]'] < $scope.xAxisRangeStart) {
          dragLayer.classList.remove('zoom-in-cursor');
          dragLayer.classList.add('zoom-out-cursor');
          $scope.xAxisRangeStart = data['xaxis.range[0]'];
        }
      });
      el.on('plotly_relayout', function (data) {
        dragLayer.classList.remove('zoom-out-cursor');
        dragLayer.classList.remove('zoom-in-cursor');
      }); // Click on a point

      el.on('plotly_click', function (data) {
        console.log('plotly_click', data);
        $("#plotly .select-outline").remove();
        $scope.resetSelect();
        $scope.points = {
          x: data.points[0].x,
          y: data.points[0].y,
          name: data.points[0].fullData.name
        };
        $scope.layout.shapes.forEach(function (shape, i) {
          if ($scope.points.x >= shape.x0 && $scope.points.x <= shape.x1 && $scope.points.y >= shape.y0 && $scope.points.y <= shape.y1) {
            $scope.layout.shapes[i].line.color = '#ffffff';
            Plotly.relayout(el, {
              '$scope.layout.shapes[i].line.color': '#ff0000',
              '$scope.layout.shapes[i].line.stroke-width': 4
            });
            $scope.toggleMenu = true;
            $scope.$apply();
          }
        });
      }); // Select a group of points.

      el.on('plotly_selected', function (data) {
        if (!data) {
          $("#plotly .select-outline").remove();
        }

        ;
        console.log('plotly_selected', data);
        $scope.points = []; // Collect selected points indexes in the points array.

        if (data && data.points && data.points.length) {
          data.points.forEach(function (point) {
            var cluster = point.curveNumber;

            if (!$scope.points[cluster]) {
              $scope.points[cluster] = [];
            }

            ; // Example: 3:[0, 1, 2, 3, 4] , where 3 - index of a cluster, array with the index of detections

            $scope.points[cluster].push(point.pointNumber);
          });
          $scope.toggleMenu = true;
          $scope.$apply();
        }
      });
    }
  }; // Navigates to the Grid View page.


  $scope.onGridViewSelected = function () {
    $scope.toggleMenu = false;
    $scope.selectedCluster = null;
    $scope.showViewGridPage = true; // View all clusters

    if (!$scope.points) {
      $scope.gridContext = $scope.originalData;
    } // Get points in different clusters, when the user selects dots by lasso or with the cluster selector
    else if ($scope.points.length) {
        $scope.gridContext = {};
        $scope.points.forEach(function (row, i) {
          $scope.gridContext[i] = {
            aed: $scope.originalData[i].aed.filter(function (a, i) {
              return row.includes(i);
            }),
            name: $scope.originalData[i].cluster
          };
        });
      } // Get selected cluster with all points in the shape
      else {
          $scope.gridContext = $scope.originalData.find(function (shape) {
            return shape.x.includes($scope.points.x) && shape.y.includes($scope.points.y);
          });
        }

    $state.go('analysis.grid-view', {
      clusteringJobId: $scope.clusteringJobId,
      gridContext: $scope.gridContext
    });
  }; // Navigates to the Visualizer page.


  $scope.showClustersInVisualizer = function () {
    if ($scope.points.length) {
      $scope.selectedClusters = {
        aed: []
      };

      for (var r in $scope.points) {
        $scope.originalData[r].aed.forEach(function (a, i) {
          if ($scope.points[r].includes(i)) {
            $scope.selectedClusters.aed.push(a);
          }

          ;
        });
      }
    } else {
      // User selects any point in one shape. It have to process all points in a shape
      $scope.selectedClusters = $scope.originalData.find(function (shape) {
        return shape.x.includes($scope.points.x) && shape.y.includes($scope.points.y);
      });
    } // Save temporary palylist with selected clusters to the local storage.


    if ($scope.selectedClusters && $scope.selectedClusters.aed && $scope.selectedClusters.aed.length) {
      if ($scope.aedDataInfo !== undefined) {
        $scope.selectedClusters.boxes = {};
        var recIds = [];
        $scope.selectedClusters.aed.forEach(function (id) {
          const indx = $scope.aedDataInfo.aed_id.findIndex(function (item) {
            return item === id;
          });
          recIds.push($scope.aedDataInfo.recording_id[indx]);
          var box = ['box', $scope.aedDataInfo.time_min[indx], $scope.aedDataInfo.freq_low[indx], $scope.aedDataInfo.time_max[indx], $scope.aedDataInfo.freq_high[indx]].join(',');

          if (!$scope.selectedClusters.boxes[$scope.aedDataInfo.recording_id[indx]]) {
            $scope.selectedClusters.boxes[$scope.aedDataInfo.recording_id[indx]] = [box];
          } else {
            $scope.selectedClusters.boxes[$scope.aedDataInfo.recording_id[indx]].push(box);
          }
        });
        $scope.removeFromLocalStorage();
        tempPlaylistData = {};
        tempPlaylistData.aed = $scope.selectedClusters.aed;
        tempPlaylistData.boxes = $scope.selectedClusters.boxes;
        tempPlaylistData.playlist = {
          id: 0,
          name: 'cluster_' + recIds.join("_"),
          recordings: recIds.filter(function (id, i, a) {
            return a.indexOf(id) === i;
          }),
          count: recIds.filter(function (id, i, a) {
            return a.indexOf(id) === i;
          }).length
        };
        $localStorage.setItem('analysis.clusters', JSON.stringify(tempPlaylistData));
        $window.location.href = '/project/' + Project.getUrl() + '/visualizer/playlist/0?clusters';
      }
    }
  };

  $scope.removeFromLocalStorage = function () {
    $localStorage.setItem('analysis.clusters', null);
    $localStorage.setItem('analysis.clusters.playlist', null);
    $state.params.clusters = '';
  };

  $scope.savePlaylist = function (opts) {
    if (!a2UserPermit.can('manage AED and Clustering job')) {
      notify.error('You do not have permission to manage AED and Clustering job');
      return;
    }

    a2Playlists.create(opts, function (data) {
      if (data && data.playlist_id) {
        $window.location.href = '/project/' + Project.getUrl() + '/visualizer/playlist/' + data.playlist_id + '?clusters';
      }
    });
  };

  $scope.showDetailsPage = function () {
    return !$scope.loading && !$scope.infopanedata && !$scope.gridViewSelected;
  };

  $scope.openFreqFilterModal = function () {
    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/clustering-jobs/frequency-filter.html',
      controller: 'a2ClusterFrequencyFilterModalController',
      size: 'sm',
      resolve: {
        data: function () {
          return {
            frequency: $scope.frequencyFilter
          };
        }
      }
    });
    modalInstance.result.then(function (result) {
      if (!result) {
        return;
      }

      $scope.useFrequencyFilterData(result);
    });
  };

  $scope.sortFilteredData = function (result) {
    var clusters = {};

    for (var c in $scope.clusters) {
      if ($scope.clusters[c].aed.length) {
        clusters[c] = {};
        clusters[c].y = [];
        clusters[c].x = [];
        clusters[c].aed = []; // Find filtered points in each cluster from the user selection.

        $scope.clusters[c].freq_high.forEach(function (freq_high, i) {
          if ($scope.clusters[c].freq_low[i] >= result.min && freq_high <= result.max) {
            clusters[c].y.push($scope.clusters[c].y[i]);
            clusters[c].x.push($scope.clusters[c].x[i]);
            clusters[c].aed.push($scope.clusters[c].aed[i]);
          }
        });

        if (!clusters[c].aed.length) {
          delete clusters[c];
        }
      }
    }

    return clusters;
  };

  $scope.useFrequencyFilterData = function (result) {
    $scope.frequencyFilter.currentMin = result.min;
    $scope.frequencyFilter.currentMax = result.max;
    $state.params.freqMin = $scope.frequencyFilter.currentMin;
    $state.params.freqMax = $scope.frequencyFilter.currentMax;
    $location.search('freqMin', $scope.frequencyFilter.currentMin);
    $location.search('freqMax', $scope.frequencyFilter.currentMax);
    var clusters = $scope.sortFilteredData(result);
    $scope.countClustersDetected = Object.keys(clusters).length;
    $scope.countAudioEventDetected = Object.values(clusters).map(function (cluster) {
      return cluster.aed.length;
    }).reduce(function (sum, current) {
      return sum + current;
    }, 0); // Display filtered points from after selection in the frequency filter.

    drawClusteringPoints(clusters);
  };

  getClusteringDetails();
}]).controller('a2ClusterFrequencyFilterModalController', ["$scope", "$modalInstance", "data", "Project", function ($scope, $modalInstance, data, Project) {
  $scope.filterData = {};
  $scope.filterData.max_freq = data.frequency.max;
  $scope.filterData.src = "/legacy-api/project/" + Project.getUrl() + "/recordings/tiles/3298382/0/0";
  $scope.has_previous_filter = true;
  $scope.frequency = data.frequency && data.frequency.currentMax ? {
    min: angular.copy(data.frequency.currentMin),
    max: data.frequency.currentMax
  } : {
    min: 0,
    max: $scope.filterData.max_freq
  };

  $scope.remove_filter = function () {
    $modalInstance.close({
      min: data.frequency.min,
      max: data.frequency.max
    });
  };

  $scope.apply_filter = function () {
    $modalInstance.close($scope.frequency);
  };
}]).controller('CreateNewClusteringJobCtrl', ["$modalInstance", "a2ClusteringJobs", "notify", function ($modalInstance, a2ClusteringJobs, notify) {
  Object.assign(this, {
    initialize: function () {
      this.loading = {
        jobs: false,
        saving: false
      };
      var list = this.list = {};
      this.data = {
        name: null,
        aed_job: {},
        params: {
          minPoints: 3,
          distanceThreshold: 0.1,
          maxClusterSize: 100
        }
      };
      this.timeout;
      this.loading.jobs = true;
      a2ClusteringJobs.audioEventDetections({
        completed: true
      }).then(function (jobs) {
        this.loading.jobs = false;
        list.jobs = jobs.map(function (job) {
          return {
            name: job.name,
            jobId: job.job_id
          };
        });
      }.bind(this));
    },
    create: function () {
      var _this = this;

      this.loading.saving = true;

      try {
        return a2ClusteringJobs.create({
          name: this.data.name,
          aed_job: this.data.aed_job,
          params: this.data.params
        }).then(function (clusteringModel) {
          $modalInstance.close({
            create: true,
            clusteringModel: clusteringModel
          });
        }.bind(this));
      } catch (error) {
        this.loading.saving = false;
        console.error(error);
      }

      clearTimeout(timeout);
      timeout = setTimeout(function () {
        _this.loading.saving = false;
      }, 2000);
    },
    cancel: function (url) {
      this.loading.jobs = false;
      this.loading.saving = false;
      $modalInstance.close({
        cancel: true,
        url: url
      });
    },
    isJobValid: function () {
      return this.data && this.data.name && this.data.name.length > 3 && this.data.aed_job;
    }
  });
  this.initialize();
}]) //------------------- Gid View page ---------------
.directive('a2GridView', function () {
  return {
    restrict: 'E',
    scope: {
      clusteringJobId: '=',
      gridContext: '=',
      onGoBack: '&'
    },
    controller: 'GridViewCtrl',
    controllerAs: 'controller',
    templateUrl: '/app/analysis/clustering-jobs/grid-view.html'
  };
}).controller('ExportReportModalCtrl', ["$scope", "$modalInstance", "a2ClusteringJobs", "data", function ($scope, $modalInstance, a2ClusteringJobs, data) {
  $scope.userEmail = data.userEmail;

  $scope.accessExportReport = function (email) {
    data.userEmail = email;
    $scope.isExporting = true;
    $scope.errMess = '';
    a2ClusteringJobs.exportClusteringROIs(data).then(function (data) {
      $scope.isExporting = false;

      if (data.error) {
        $scope.errMess = data.error;
      } else {
        $modalInstance.close();
      }
    });
  };

  $scope.changedUserEmail = function () {
    $scope.errMess = null;
  };
}]).controller('GridViewCtrl', ["$scope", "$http", "a2UserPermit", "a2ClusteringJobs", "a2AudioBarService", "a2AudioEventDetectionsClustering", "Project", "Songtypes", "a2Playlists", "notify", "$modal", "$localStorage", function ($scope, $http, a2UserPermit, a2ClusteringJobs, a2AudioBarService, a2AudioEventDetectionsClustering, Project, Songtypes, a2Playlists, notify, $modal, $localStorage) {
  $scope.loading = true;
  $scope.isSquareSize = false;
  $scope.infopanedata = '';
  $scope.projectUrl = Project.getUrl();
  $scope.allRois = [];
  $scope.selectedRois = [];
  $scope.paginationSettings = {
    page: 1,
    limit: 100,
    offset: 0,
    totalItems: 0,
    totalPages: 0
  };
  $scope.lists = {
    search: [{
      value: 'all',
      text: 'All',
      description: 'Show all matched rois.'
    }, {
      value: 'per_cluster',
      text: 'Sort per Cluster',
      description: 'Show all rois ranked per Cluster.'
    }, {
      value: 'per_site',
      text: 'Sort per Site',
      description: 'Show all rois ranked per Site.'
    }, {
      value: 'per_date',
      text: 'Sort per Date',
      description: 'Show all rois sorted per Date.'
    }, {
      value: 'per_species',
      text: 'Sort per Species',
      description: 'Show all rois sorted per Species.'
    }],
    validation: [{
      class: "fa val-1",
      text: 'Present',
      value: 1
    }, {
      class: "fa val-0",
      text: 'Not Present',
      value: 0
    }, {
      class: "fa val-null",
      text: 'Clear',
      value: -1
    }]
  };
  $scope.validation = {
    status: $scope.lists.validation[2]
  };
  $scope.selectedFilterData = $scope.lists.search[1];
  $scope.playlistData = {};
  $scope.aedData = {
    count: 0,
    id: []
  };
  $scope.speciesLoading = false;
  $scope.selected = {
    species: null,
    songtype: null
  };
  var timeout;
  var isShiftKeyHolding = false;

  if ($scope.gridContext && $scope.gridContext.aed) {
    $scope.gridData = [];
    $scope.gridData.push($scope.gridContext);
    $scope.aedData.count = 1;
    $scope.gridContext.aed.forEach(function (i) {
      return $scope.aedData.id.push(i);
    });
  } else {
    $scope.gridData = Object.values($scope.gridContext);
    $scope.aedData.count = $scope.gridData.length;
    $scope.gridData.forEach(function (data) {
      data.aed.forEach(function (i) {
        return $scope.aedData.id.push(i);
      });
    });
  }

  $localStorage.setItem('analysis.gridContext', JSON.stringify($scope.gridContext));
  a2ClusteringJobs.getJobDetails($scope.clusteringJobId).then(function (data) {
    if (data) $scope.job_details = data;
  }).catch(function (err) {
    console.log(err);
  });

  $scope.onSearchChanged = function (item) {
    $scope.selectedFilterData = item;
    $scope.getRoisDetails(true).then(function () {
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        $scope.markBoxesAsSelected();
        $scope.updateInputState();
      }, 100);
    });
  };

  $scope.setCurrentPage = function () {
    this.paginationSettings.offset = $scope.paginationSettings.page - 1;
    $scope.getRoisDetails();
  };

  $scope.showPagination = function () {
    // if ($scope.selectedFilterData.value === 'per_cluster') {
    //     return $scope.paginationSettings.totalItems && ($scope.gridData.length && $scope.gridData.length > 1)
    // } else {
    return $scope.paginationSettings.totalItems && $scope.paginationSettings.totalItems > $scope.paginationSettings.limit; // }
  };

  $scope.getRoisDetails = function (isFilterChanged) {
    if (!$scope.aedData.id.length) {
      return $scope.getStatusForEmptyData();
    }

    $scope.rows = [];
    var aedData;
    $scope.isRoisLoading = true;

    if (isFilterChanged) {
      $scope.paginationSettings.page = 1;
      $scope.paginationSettings.offset = 0;
    } // if ($scope.selectedFilterData.value === 'per_cluster') {
    //     aedData = $scope.gridData[$scope.paginationSettings.page-1].aed;
    //     $scope.paginationSettings.totalItems = $scope.gridData.length;
    //     $scope.paginationSettings.limit = 1;
    // } else {


    $scope.paginationSettings.limit = 100;
    $scope.paginationSettings.totalItems = $scope.aedData.id.length;
    aedData = $scope.aedData.id.filter(function (id, i, a) {
      return i >= $scope.paginationSettings.offset * $scope.paginationSettings.limit && i < $scope.paginationSettings.page * $scope.paginationSettings.limit;
    }); // }

    return a2ClusteringJobs.getRoisDetails({
      jobId: $scope.clusteringJobId,
      aed: aedData,
      search: $scope.selectedFilterData.value
    }).then(function (data) {
      const groupedData = [];
      Object.values($scope.gridData).forEach(function (cluster) {
        Object.entries(cluster).forEach(function (entry) {
          if (entry[0] == "aed") {
            entry[1].forEach(function (id) {
              const matched = data.find(function (aed) {
                return aed.aed_id === id;
              });

              if (matched) {
                matched.cluster = cluster.name;
                groupedData.push(matched);
              }
            });
          }
        });
      }); // if ($scope.selectedFilterData.value === 'per_cluster') {
      //     $scope.paginationSettings.totalPages = $scope.gridData.length;
      //     $scope.paginationSettings.limit = 1;
      // } else {

      $scope.paginationSettings.totalPages = Math.ceil($scope.paginationSettings.totalItems / $scope.paginationSettings.limit);
      $scope.paginationSettings.limit = 100; // }

      $scope.loading = false;
      $scope.allRois = groupedData;
      $scope.isRoisLoading = false;
      $scope.getRoisDetailsSegment();
      $scope.combineRoisPerCluster();
    }).catch(function (err) {
      console.log(err);
      $scope.getStatusForEmptyData();
    });
  };

  $scope.getRoisDetails();

  $scope.combineRoisPerCluster = function () {
    $scope.roisPerCluster = {};
    $scope.gridData.forEach(function (cluster) {
      $scope.roisPerCluster[cluster.name] = cluster.aed;
    });
  };

  $scope.exportReport = function () {
    if (!a2UserPermit.can('manage AED and Clustering job')) {
      notify.error('You do not have permission to download Clustering details');
      return;
    }

    var params = {
      jobId: $scope.clusteringJobId,
      aed: $scope.aedData.id,
      cluster: $scope.roisPerCluster,
      search: $scope.selectedFilterData.value,
      userEmail: a2UserPermit.getUserEmail() || ''
    };

    if ($scope.selectedFilterData.value == 'per_site') {
      params.perSite = true;
    } else if ($scope.selectedFilterData.value == 'per_date') {
      params.perDate = true;
    } else params.all = true;

    $scope.openExportPopup(params);
  };

  $scope.openExportPopup = function (listParams) {
    const modalInstance = $modal.open({
      controller: 'ExportReportModalCtrl',
      templateUrl: '/app/analysis/clustering-jobs/export-report.html',
      resolve: {
        data: function () {
          return listParams;
        }
      },
      backdrop: false
    });
    modalInstance.result.then(function () {
      notify.log('Your report export request is processing <br> and will be sent by email.');
    });
  };

  $scope.getStatusForEmptyData = function () {
    $scope.loading = false;
    $scope.isRoisLoading = false;
    $scope.infopanedata = 'No data for clustering job found.';
  };

  $scope.getRoisDetailsSegment = function () {
    const data = $scope.allRois;

    if (data && $scope.selectedFilterData.value === 'per_site') {
      var sites = {};
      data.forEach(function (item) {
        if (!sites[item.site_id]) {
          sites[item.site_id] = {
            id: item.site_id,
            site: item.site,
            species: [item]
          };
        } else {
          sites[item.site_id].species.push(item);
        }
      });
      const rows = Object.values(sites).map(function (site) {
        return {
          id: site.id,
          site: site.site,
          species: $scope.groupRoisBySpecies(site.species)
        };
      });
      $scope.rows = rows;
    } else if (data && $scope.selectedFilterData.value === 'per_cluster') {
      $scope.ids = {};

      if ($scope.aedData.count > 1) {
        var grids = [];
        $scope.gridData.forEach(function (row) {
          grids.push([row]);
        });
        grids.forEach(function (row, index) {
          $scope.ids[index] = {
            id: row[0].cluster || row[0].name,
            cluster: row[0].cluster || row[0].name,
            species: $scope.groupRoisBySpecies(data, row[0].aed)
          };
        });
      } else {
        $scope.ids[0] = {
          id: $scope.gridData[0].cluster || $scope.gridData[0].name,
          cluster: $scope.gridData[0].cluster || $scope.gridData[0].name,
          species: $scope.groupRoisBySpecies(data)
        };
      }

      $scope.rows = Object.values($scope.ids);
    } else if (data && $scope.selectedFilterData.value === 'per_species') {
      var speciesObj = {};
      data.forEach(function (roi) {
        if (!speciesObj[roi.species_id]) {
          speciesObj[roi.species_id] = {
            id: roi.species_id,
            speciesName: roi.scientific_name,
            species: [roi]
          };
        } else {
          speciesObj[roi.species_id].species.push(roi);
        }
      });
      const rows = Object.values(speciesObj).map(function (row) {
        return {
          id: row.id,
          speciesName: row.speciesName || 'Unvalidated ROIs',
          species: $scope.groupRoisBySpecies(row.species)
        };
      });
      $scope.rows = rows;
    } else {
      if ($scope.selectedFilterData.value === 'per_date') {
        data.sort(function (a, b) {
          return a.date_created < b.date_created ? 1 : -1;
        });
      }

      $scope.rows = [];
      $scope.rows.push({
        species: [{
          rois: data
        }]
      });
    }
  };

  $scope.groupRoisBySpecies = function (data, aeds) {
    const rois = aeds ? data.filter(function (a, i) {
      return aeds.includes(a.aed_id);
    }) : data;
    var species = {};
    rois.forEach(function (item) {
      const key = item.scientific_name ? item.scientific_name + '-' + item.songtype : 'Unvalidated ROIs';

      if (!species[key]) {
        species[key] = {
          key: key,
          rois: [item]
        };
      } else {
        species[key].rois.push(item);
      }
    });
    return Object.values(species);
  };

  $scope.playRoiAudio = function (recId, aedId, $event) {
    if ($event) {
      $event.preventDefault();
      $event.stopPropagation();
    }

    a2AudioBarService.loadUrl(a2ClusteringJobs.getAudioUrlFor(recId, aedId), true);
  };

  $scope.getRoiVisualizerUrl = function (roi) {
    var projecturl = Project.getUrl();
    var box = ['box', roi.time_min, roi.frequency_min, roi.time_max, roi.frequency_max].join(',');
    return roi ? '/project/' + projecturl + '/#/visualizer/rec/' + roi.recording_id + '?a=' + box : '';
  };

  $scope.togglePopup = function () {
    $scope.isPopupOpened = !$scope.isPopupOpened;
  };

  $scope.toggleBoxSize = function () {
    $scope.isSquareSize = !$scope.isSquareSize;
  };

  $scope.isPlaylistDataValid = function () {
    return $scope.selectedRois && $scope.selectedRois.length && $scope.playlistData.playlistName && $scope.playlistData.playlistName.trim().length > 0;
  };

  $scope.closePopup = function () {
    $scope.isPopupOpened = false;
  };

  $scope.savePlaylist = function () {
    if ($scope.selectedRois.length) {
      $scope.isSavingPlaylist = true; // Create a new playlist with aed boxes.

      a2Playlists.create({
        playlist_name: $scope.playlistData.playlistName,
        params: $scope.selectedRois,
        recIdsIncluded: true
      }, function (data) {
        $scope.isSavingPlaylist = false;
        $scope.closePopup(); // Attach aed to the new playlist.

        if (data && data.playlist_id) {
          a2Playlists.attachAedToPlaylist({
            playlist_id: data.playlist_id,
            aed: $scope.selectedRois
          }, function (data) {
            $scope.playlistData = {};
            notify.log('Audio event detections are saved in the playlist. <br> Navigates to the Visualizer page to see Audio Event boxes on the spectrogram');
          });
        }
      });
    }
  };

  $scope.isValidationAccessible = function () {
    return a2UserPermit.can('manage AED and Clustering job');
  };

  $scope.setValidation = function () {
    if (!a2UserPermit.can('manage AED and Clustering job')) {
      notify.error('You do not have permission to manage AED and Clustering job');
      return;
    }

    if ($scope.validation.status.value === 1 && (!$scope.selected.species || !$scope.selected.songtype)) {
      notify.error('Please select Species and Song type <br> to validate ROIs with the Present validation');
      return;
    }

    if ($scope.validation.status.value === 0 && (!$scope.selected.species || !$scope.selected.songtype)) {
      notify.error('Please select Species and Song type <br> to validate ROIs with the Absent validation');
      return;
    }

    $scope.speciesLoading = true;
    var opts = {
      aed: $scope.selectedRois,
      validated: $scope.validation.status.value
    };
    const isClearValidation = $scope.validation.status.value === -1;
    opts.species_name = isClearValidation ? null : $scope.selected.species.scientific_name;
    opts.songtype_name = isClearValidation ? null : $scope.selected.songtype.name;
    opts.species_id = isClearValidation ? null : $scope.selected.species.id;
    opts.songtype_id = isClearValidation ? null : $scope.selected.songtype.id;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      a2AudioEventDetectionsClustering.validate(opts).then(function (data) {
        console.info('Validation result', data); // Unselect and mark boxes with current validation without reloading the page

        $scope.markBoxesWithCurrentValidation();
        $scope.unselectBoxes();
        $scope.selectedRois = [];

        if ($scope.validation.status.value === 1) {
          notify.log('Audio event detections are validated as ' + $scope.selected.species.scientific_name + ' ' + $scope.selected.songtype.name);
        }

        $scope.selected = {
          species: null,
          songtype: null
        };
        $scope.updateInputState();
        $scope.getRoisDetails();
      }).finally(function () {
        $scope.speciesLoading = false;
      });
    }, 500);
  };

  $scope.markBoxesWithCurrentValidation = function () {
    $scope.rows.forEach(function (row) {
      row.species.forEach(function (cluster) {
        cluster.rois.forEach(function (roi) {
          if ($scope.selectedRois.includes(roi.aed_id)) {
            roi.validated = $scope.validation.status.value;
          }
        });
      });
    });
  };

  $scope.unselectBoxes = function () {
    $scope.rows.forEach(function (row) {
      row.species.forEach(function (cluster) {
        cluster.rois.forEach(function (roi) {
          if (roi.selected) {
            roi.selected = false;
          }
        });
      });
    });
  };

  $scope.markBoxesAsSelected = function () {
    $scope.rows.forEach(function (row) {
      row.species.forEach(function (cluster) {
        cluster.rois.forEach(function (roi) {
          if ($scope.selectedRois.includes(roi.aed_id)) {
            roi.selected = true;
          }
        });
      });
    });
  };

  Songtypes.get(function (songs) {
    $scope.songtypes = songs;
  });

  $scope.searchSpecies = function (search) {
    $scope.selected.songtype = null;
    $scope.speciesLoading = true;
    return $http.get('/legacy-api/species/search', {
      params: {
        q: search
      }
    }).then(function (result) {
      $scope.speciesLoading = false;
      return result.data;
    });
  };

  $scope.onScroll = function ($event, $controller) {
    this.scrollElement = $controller.scrollElement;
    var scrollPos = $controller.scrollElement.scrollY;
    var headerTop = $controller.anchors.header.offset().top;
    this.headerTop = headerTop | 0;
    this.scrolledPastHeader = scrollPos > headerTop;
  };

  var getSelectedDetectionIds = function () {
    $scope.rows.forEach(function (row) {
      row.species.forEach(function (cluster) {
        cluster.rois.forEach(function (roi) {
          if (roi.selected === true && !$scope.selectedRois.includes(roi.aed_id)) {
            $scope.selectedRois.push(roi.aed_id);
          }

          if (roi.selected === false && $scope.selectedRois.includes(roi.aed_id)) {
            const index = $scope.selectedRois.findIndex(function (item) {
              return item === roi.aed_id;
            });
            $scope.selectedRois.splice(index, 1);
          }
        });
      });
    });
    return $scope.selectedRois;
  };

  $scope.selectCluster = function (cluster) {
    const isSelected = cluster.selected;
    cluster.rois = cluster.rois.map(function (roi) {
      roi.selected = isSelected === true ? true : false;
      return roi;
    });
    $scope.selectedRois = getSelectedDetectionIds();
    $scope.updateInputState();
  };

  var getCombinedDetections = function () {
    var combinedDetections = [];
    $scope.rows.forEach(function (row) {
      row.species.forEach(function (cluster) {
        combinedDetections = combinedDetections.concat(cluster.rois);
      });
    });
    return combinedDetections;
  }; // Selection with a shift key


  $scope.toggleDetection = function (event) {
    isShiftKeyHolding = event.shiftKey;

    if (isShiftKeyHolding) {
      const combinedDetections = getCombinedDetections();
      const selectedDetectionIds = getSelectedDetectionIds();
      const firstInx = combinedDetections.findIndex(function (d) {
        return d.aed_id === selectedDetectionIds[0];
      });
      const secondInx = combinedDetections.findIndex(function (det) {
        return det.aed_id === selectedDetectionIds[selectedDetectionIds.length - 1];
      });
      const arrayOfIndx = [firstInx, secondInx].sort(function (a, b) {
        return a - b;
      });
      const filteredDetections = combinedDetections.filter(function (_det, index) {
        return index >= arrayOfIndx[0] && index <= arrayOfIndx[1];
      });
      const ids = filteredDetections.map(function (det) {
        return det.aed_id;
      });
      $scope.rows.forEach(function (row) {
        row.species.forEach(function (cluster) {
          cluster.rois.forEach(function (roi) {
            if (ids.includes(roi.aed_id)) {
              roi.selected = true;
            }
          });
        });
      });
    }

    $scope.selectedRois = getSelectedDetectionIds();
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      $scope.updateInputState();
    }, 100);
  }; // Set cluster's input state


  $scope.updateInputState = function () {
    const inputs = document.querySelectorAll("[id^='inputCluster_']");
    if (!inputs.length) return;
    var index = 0;
    $scope.rows.forEach(function (row) {
      row.species.forEach(function (cluster) {
        const selectedRois = cluster.rois.filter(function (roi) {
          return roi.selected;
        });

        if (!selectedRois.length) {
          inputs[index].checked = false;
          inputs[index].indeterminate = false;
        } else if (selectedRois.length === cluster.rois.length) {
          inputs[index].indeterminate = false;
          inputs[index].checked = true;
        } else {
          inputs[index].checked = false;
          inputs[index].indeterminate = true;
        }

        index++;
      });
    });
  };
}]);
angular.module('a2.analysis.cnn', ['ui.bootstrap', 'a2.directive.audio-bar', 'a2.srv.cnn', 'a2.services', 'a2.permissions', 'humane', 'c3-charts']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('analysis.disabled-cnn', {
    url: '/disabled/cnn',
    templateUrl: '/app/analysis/cnn/disabled.html'
  }).state('analysis.cnn', {
    url: '/cnn/',
    controller: 'CNNCtrl',
    templateUrl: '/app/analysis/cnn/list.html'
  }).state('analysis.cnn-details', {
    url: '/cnn/:cnnId',
    ///:detailType/',
    controller: 'CNNCtrl',
    templateUrl: '/app/analysis/cnn/list.html'
  });
}]).controller('CNNCtrl', ["$scope", "$modal", "$filter", "$location", "Project", "ngTableParams", "JobsData", "a2CNN", "a2Playlists", "notify", "$q", "a2UserPermit", "$state", "$stateParams", function ($scope, $modal, $filter, $location, Project, ngTableParams, JobsData, a2CNN, a2Playlists, notify, $q, a2UserPermit, $state, $stateParams) {
  // this debug line for sanity between servers... Will remove TODO
  console.log("CNN Version 1.0");
  $scope.selectedCNNId = $stateParams.cnnId;

  var initTable = function (p, c, s, f, t) {
    var sortBy = {};
    var acsDesc = 'desc';

    if (s[0] == '+') {
      acsDesc = 'asc';
    }

    sortBy[s.substring(1)] = acsDesc;
    var tableConfig = {
      page: p,
      count: c,
      sorting: sortBy,
      filter: f
    };
    $scope.tableParams = new ngTableParams(tableConfig, {
      total: t,
      getData: function ($defer, params) {
        $scope.infopanedata = "";
        var filteredData = params.filter() ? $filter('filter')($scope.cnnOriginal, params.filter()) : $scope.cnnOriginal;
        var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.cnnOriginal;
        params.total(orderedData.length);
        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

        if (orderedData.length < 1) {
          $scope.infopanedata = "No cnn searches found.";
        }

        $scope.cnnsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
      }
    });
  };

  $scope.loadCNNs = function () {
    $scope.loading = true;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    return a2CNN.list().then(function (data) {
      $scope.cnnOriginal = data;
      $scope.cnnsData = data;
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
      $scope.infopanedata = "";

      if (data.length > 0) {
        if (!$scope.tableParams) {
          initTable(1, 10, "-timestamp", {}, data.length);
        } else {
          $scope.tableParams.reload();
        }
      } else {
        $scope.infopanedata = "No cnns found.";
      }
    });
  };

  if (!$scope.selectedCNNId) {
    $scope.loadCNNs();
  }

  $scope.createNewCNN = function () {
    // TODO: add in real cnn permissions
    if (!a2UserPermit.can('manage cnns')) {
      notify.error('You do not have permission to create cnn jobs.');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/cnn/createnewcnn.html',
      controller: 'CreateNewCNNInstanceCtrl as controller'
    });
    modalInstance.result.then(function (result) {
      data = result;

      if (data.ok) {
        JobsData.updateJobs();
        notify.log("Your new cnn is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
      } else if (data.error) {
        notify.error("Error: " + data.error);
      } else if (data.url) {
        $location.path(data.url);
      }
    });
  };

  $scope.deleteCNN = function (cnn, $event) {
    $event.stopPropagation();

    if (!a2UserPermit.can('manage cnns')) {
      notify.error('You do not have permission to delete cnns.');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/cnn/deletecnn.html',
      controller: 'DeleteCNNInstanceCtrl as controller',
      resolve: {
        cnn: function () {
          return cnn;
        }
      }
    });
    modalInstance.result.then(function (ret) {
      if (ret.err) {
        notify.error("Error: " + ret.err);
      } else {
        notify.log("CNN: (" + cnn.name + ") deleted successfully");
        $scope.loadCNNs();
        /*
        var index = -1;
        var modArr = angular.copy($scope.cnnOriginal);
        for (var i = 0; i < modArr.length; i++) {
            if (modArr[i].job_id === cnn.job_id) {
                index = i;
                break;
            }
        }
        if (index > -1) {
            $scope.cnnOriginal.splice(index, 1);
            notify.log("CNN deleted successfully");
        }
        */
      }
    });
  };

  $scope.selectItem = function (cnnId) {
    if (!cnnId) {
      $state.go('analysis.cnn', {});
    } else {
      $state.go('analysis.cnn-details', {
        cnnId: cnnId //detailType: 'all'

      });
    }
  };

  $scope.setDetailedView = function (detailedView) {
    $scope.detailedView = detailedView;
    $state.transitionTo($state.current.name, {
      patternMatchingId: $scope.selectedPatternMatchingId,
      show: detailedView ? "detail" : "gallery"
    }, {
      notify: false
    });
  };
}]).controller('DeleteCNNInstanceCtrl', ["$scope", "$modalInstance", "a2CNN", "cnn", "Project", function ($scope, $modalInstance, a2CNN, cnn, Project) {
  this.cnn = cnn;
  $scope.project_name = Project.getUrl();
  $scope.deletingloader = false;

  $scope.ok = function () {
    $scope.deletingloader = true;
    a2CNN.delete(cnn.job_id).then(function (data) {
      $modalInstance.close(data);
    });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]).controller('CreateNewCNNInstanceCtrl', ["$scope", "$modalInstance", "a2PatternMatching", "a2Templates", "a2Playlists", "a2CNN", "notify", function ($scope, $modalInstance, a2PatternMatching, a2Templates, a2Playlists, a2CNN, notify) {
  Object.assign(this, {
    initialize: function () {
      this.loading = {
        playlists: false,
        models: false
      };
      var list = this.list = {};
      list.lambdas = [{
        'name': 'call_id_testing:1 - create fake data',
        'key': "new_cnn_job_test1"
      }, {
        'name': 'function_id_driver - test real function',
        'key': "new_cnn_job_v1"
      }];
      this.data = {
        name: null,
        playlist: null,
        model: null,
        lambda: list.lambdas[0],
        params: {}
      };
      this.loading.models = true;
      a2CNN.listModels().then(function (models) {
        this.loading.models = false;
        list.models = models;
      }.bind(this));
      this.loading.playlists = true;
      a2Playlists.getList().then(function (playlists) {
        this.loading.playlists = false;
        list.playlists = playlists;
      }.bind(this));
    },
    ok: function () {
      try {
        return a2CNN.create({
          playlist_id: this.data.playlist.id,
          cnn_id: this.data.model.id,
          name: this.data.name,
          lambda: this.data.lambda.key,
          params: this.data.params
        }).then(function (cnn) {
          $modalInstance.close({
            ok: true,
            cnn: cnn
          });
        }).catch(notify.serverError);
      } catch (error) {
        console.error("a2CNN.create error: " + error);
      }
    },
    cancel: function (url) {
      $modalInstance.close({
        cancel: true,
        url: url
      });
    }
  });
  this.initialize();
}]).directive('a2CnnDetails', function () {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      cnnId: '=',
      detailedView: '=',
      onSetDetailedView: '&',
      onGoBack: '&'
    },
    controller: 'CNNDetailsCtrl',
    controllerAs: 'controller',
    templateUrl: '/app/analysis/cnn/details.html'
  };
}).controller('CNNDetailsCtrl', ["$scope", "$state", "ngTableParams", "a2AudioPlayer", "$filter", "a2CNN", "a2UserPermit", "Project", "a2AudioBarService", "notify", function ($scope, $state, ngTableParams, a2AudioPlayer, $filter, a2CNN, a2UserPermit, Project, a2AudioBarService, notify) {
  var projecturl = Project.getUrl();
  $scope.lists = {
    thumbnails: [{
      class: 'fa fa-th-large',
      value: ''
    }, {
      class: 'fa fa-th',
      value: 'is-small'
    }],
    search: [{
      value: 'all',
      text: 'All',
      description: 'Show all matched rois.'
    }, {
      value: 'present',
      text: 'Present',
      description: 'Show all rois marked as present.'
    }, {
      value: 'not_present',
      text: 'Not Present',
      description: 'Show all rois marked as not present.'
    }, {
      value: 'unvalidated',
      text: 'Unvalidated',
      description: 'Show all rois without validation.'
    }, {
      value: 'by_score',
      text: 'Score per Species',
      description: 'Show rois ranked by score per species.'
    }, {
      value: 'by_score_per_site',
      text: 'Score per Site',
      description: 'Show rois ranked by score per site.'
    }],
    selection: [{
      value: 'all',
      text: 'All'
    }, {
      value: 'none',
      text: 'None'
    }, {
      value: 'not-validated',
      text: 'Not Validated'
    }],
    validation: [{
      class: "fa val-1",
      text: "Present",
      value: 1
    }, {
      class: "fa val-0",
      text: "Not Present",
      value: 0
    }, {
      class: "fa val-null",
      text: "Clear",
      value: null
    }],
    current: {
      thumbnailClass: 'is-small'
    }
  };
  $scope.total = {
    rois: 0,
    pages: 0
  };
  $scope.selected = {
    roi_index: 0,
    roi: null,
    page: 0,
    search: $scope.lists.search[4]
  };
  $scope.validation = {
    current: $scope.lists.validation[2]
  };
  $scope.offset = 0;
  $scope.limit = 100; //$scope.viewType = "species";

  var setupExportUrl = function () {
    $scope.CNNExportUrl = a2CNN.getExportUrl({
      cnnId: $scope.cnnId
    });
  };

  $scope.exportCnnReport = function ($event) {
    $event.stopPropagation();
    if (a2UserPermit.isSuper()) return setupExportUrl();

    if (a2UserPermit.all && !a2UserPermit.all.length || !a2UserPermit.can('export report')) {
      return notify.error('You do not have permission to export CNN data');
    } else return setupExportUrl();
  };

  var audio_player = new a2AudioPlayer($scope);

  var initTable = function (p, c, s, f, t) {
    var sortBy = {};
    var acsDesc = 'desc';

    if (s[0] == '+') {
      acsDesc = 'asc';
    }

    sortBy[s.substring(1)] = acsDesc;
    var tableConfig = {
      page: p,
      count: c,
      sorting: sortBy,
      filter: f
    };
    $scope.tableParams = new ngTableParams(tableConfig, {
      total: t,
      getData: function ($defer, params) {
        $scope.infopanedata = "";
        var filteredData = params.filter() ? $filter('filter')($scope.cnnOriginal, params.filter()) : $scope.cnnOriginal;
        var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.cnnOriginal;
        params.total(orderedData.length);
        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

        if (orderedData.length < 1) {
          $scope.infopanedata = "No cnn searches found.";
        }

        cnnsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());

        if ($scope.viewType == "species") {
          $scope.species = cnnsData;
        } else if ($scope.viewType == "recordings") {
          $scope.recordings = cnnsData;
        } else {
          $scope.mainResults = cnnsData;
        }
      }
    });
  }; //$scope.viewType = "all";


  $scope.counts = {
    recordings: null
  };

  $scope.onSelect = function (item) {
    $scope.select(item.value);
  };

  $scope.select = function (option) {
    var selectFn = null;

    if (option === "all") {
      selectFn = function (roi) {
        roi.selected = true;
      };
    } else if (option === "none") {
      selectFn = function (roi) {
        roi.selected = false;
      };
    } else if (option === "not-validated") {
      selectFn = function (roi) {
        roi.selected = roi.validated === null;
      };
    } else {
      selectFn = function (roi) {
        roi.selected = roi.id === option;
      };
    }

    ($scope.resultsROIs || []).forEach(selectFn);
  };

  var refreshDetails = function () {
    a2CNN.getDetailsFor($scope.cnnId).then(function (data) {
      $scope.job_details = data;
    });
  };

  refreshDetails();

  var bySpecies = function (dataIn) {
    var dataOut = {};
    dataIn.forEach(function (element) {
      var s = element.species_id;

      if (!(s in dataOut)) {
        dataOut[s] = {
          count: 0,
          species_id: s,
          scientific_name: element.scientific_name
        };
      }

      if (element.present == 1) {
        dataOut[s].count++;
      }
    });
    return dataOut;
  };

  var byROIs = function (dataIn, thresh) {
    if (!thresh) {
      thresh = 0.9;
    }

    var dataOut = [];
    dataIn.forEach(function (element) {
      element.over_thresh = element.score >= thresh;
      element.present = element.over_thresh;
      dataOut.push(element);
    });
    dataOut.sort(function (a, b) {
      return a.score < b.score ? 1 : -1;
    });
    return dataOut;
  };

  var byROIsbySpecies = function (dataIn, bySite) {
    dataOut = {};
    dataIn.forEach(function (element) {
      var s = bySite ? element.site : element.species_id + '_' + element.songtype_id;

      if (!(s in dataOut)) {
        dataOut[s] = {
          count: 0,
          species_id: element.species_id,
          songtype_id: element.songtype_id,
          scientific_name: element.scientific_name,
          songtype: element.songtype,
          rois: []
        };
        if (bySite) dataOut[s].site = element.site;
      }

      dataOut[s].rois.push(element);
      dataOut[s].count++;
    });
    return dataOut;
  };

  var byRecordings = function (dataIn) {
    var dataOut = {
      total: 0
    };
    dataIn.forEach(function (element) {
      var r = element.recording_id;
      var s = element.species_id;

      if (!(r in dataOut)) {
        dataOut[r] = {
          recording_id: r,
          thumbnail: element.thumbnail,
          species: {},
          total: 0,
          species_list: ''
        };
      }

      if (!(s in dataOut[r].species)) {
        dataOut[r].species[s] = {
          species_id: s,
          scientific_name: element.scientific_name,
          count: 0
        };
      }

      if (element.present == 1) {
        if (dataOut[r].species[s].count == 0) {
          dataOut[r].species_list = dataOut[r].species_list + ' ' + element.scientific_name;
        }

        dataOut[r].species[s].count++;
        dataOut[r].total++;
      }
    });
    return dataOut;
  };

  var bySpeciesHist = function (dataIn, species_id) {
    speciesTimes = [];
    count = 0;
    speciesName = 'All'; //fix this... ugh

    dataIn.forEach(function (element) {
      if (species_id == 'all' | element.species_id == species_id) {
        if (species_id == 'all') {
          speciesName = 'All';
        } else {
          speciesName = element.scientific_name;
        }

        if (element.present == 1) {
          var d = new Date(element.datetime);
          var minutes = d.getHours() * 60 + d.getMinutes();
          speciesTimes.push(new Date(3000, 0, 1, d.getHours(), d.getMinutes()));
          count++;
        }
      }
    });
    return {
      times: speciesTimes,
      count: count,
      name: speciesName
    };
  };

  var plotShown = false;

  $scope.showHist = function (species_id) {
    $scope.speciesInfo = bySpeciesHist($scope.results, species_id);
    var trace = {
      x: $scope.speciesInfo.times,
      type: 'histogram',
      //xbins: {size: new Date(3000, 0, 2, 2).getTime() - new Date(3000, 0, 2, 0).getTime()}
      //magic numbers for full day/2 hour bins
      xbins: {
        start: 32503698000000,
        end: 32503791600000,
        size: 7200000
      }
    };
    var layout = {
      title: $scope.speciesInfo.name + ' by time of day.',
      xaxis: {
        tickformat: '%X',
        // For more time formatting types, see: https://github.com/d3/d3-time-format/blob/master/README.md
        range: [new Date(3000, 0, 1).getTime(), new Date(3000, 0, 2).getTime()]
      }
    };
    var data = [trace];

    if (!plotShown) {
      Plotly.newPlot('speciesHist', data, layout);
      plotShown = true;
    } else {
      Plotly.newPlot('speciesHist', data, layout);
    }
  };

  $scope.getRecordingVisualizerUrl = function (recording_id) {
    return "/project/" + Project.getUrl() + "/visualizer/rec/" + recording_id;
  };

  $scope.getRoiVisualizerUrl = function (roi) {
    var box = ['box', roi.x1, roi.y1, roi.x2, roi.y2].join(',');
    return roi ? "/project/" + projecturl + "/#/visualizer/rec/" + roi.recording_id + "?a=" + box : '';
  };

  $scope.getTemplateVisualizerUrl = function (template) {
    var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
    return template ? "/project/" + projecturl + "/visualizer/rec/" + template.recording + "?a=" + box : '';
  };

  $scope.playRoiAudio = function (roi, $event) {
    if ($event) {
      $event.preventDefault();
      $event.stopPropagation();
    }

    a2AudioBarService.loadUrl(a2CNN.getAudioUrlFor(roi), true);
  };

  $scope.setPage = function (page, force) {
    page = Math.max(0, Math.min(page, $scope.total.rois / $scope.limit | 0));

    if (page != $scope.selected.page || force) {
      $scope.selected.page = page;
      $scope.offset = page * $scope.limit;
      loadROIPage();
    }
  };

  $scope.moveROIPage = function (n) {
    var nextPage = $scope.selected.page + n;

    if (nextPage > $scope.total.pages - 1) {
      $scope.setPage(0);
    } else if (nextPage < 0) {
      $scope.setPage($scope.total.pages - 1);
    } else {
      $scope.setPage(nextPage);
    }
  };

  $scope.setSpecies = function (species) {
    $scope.selected.species = species;
    $scope.selected.page = 0;
    $scope.offset = 0;
    var site_name = "site_" + $scope.selected.site.site_id + "_" + $scope.selected.site.name;

    if ($scope.selected.site.site_id == 0) {
      site_name = 0;
    }

    $scope.counts.roi_species_counts = getSpeciesCounts(site_name, $scope.roi_species_sites_counts);
    $scope.counts.roi_sites_counts = getSitesCounts($scope.selected.species.species_id, $scope.roi_species_sites_counts);
    var count_all_species = $scope.counts.roi_species_counts.reduce(function (count, current) {
      return count = count + current.N;
    }, 0);
    all_species = {
      species_id: 0,
      N: count_all_species,
      scientific_name: "All Species"
    };
    $scope.counts.roi_species_counts.unshift(all_species);
    var count_all_sites = $scope.counts.roi_sites_counts.reduce(function (count, current) {
      return count = count + current.N;
    }, 0);
    var all_site = {
      site_id: 0,
      N: count_all_sites,
      name: "All Sites"
    };
    $scope.counts.roi_sites_counts.unshift(all_site);
    $scope.selected.site = $scope.counts.roi_sites_counts.find(function (element) {
      return element.site_id == $scope.selected.site.site_id;
    });
    $scope.selected.species = $scope.counts.roi_species_counts.find(function (element) {
      return element.species_id == $scope.selected.species.species_id;
    }); //$scope.counts.roi_sites_counts.unshift($scope.selected.site);
    //$scope.selected.site = all_site;

    $scope.total = {
      rois: species.N,
      pages: Math.ceil(species.N / $scope.limit)
    };
    loadROIPage();
  };

  $scope.counts = {};

  $scope.setSite = function (site) {
    $scope.selected.site = site;
    $scope.selected.page = 0;
    $scope.offset = 0;
    var site_name = "site_" + $scope.selected.site.site_id + "_" + $scope.selected.site.name;

    if ($scope.selected.site.site_id == 0) {
      site_name = 0;
    }

    $scope.counts.roi_species_counts = getSpeciesCounts(site_name, $scope.roi_species_sites_counts);
    $scope.counts.roi_sites_counts = getSitesCounts($scope.selected.species.species_id, $scope.roi_species_sites_counts);
    var count_all_species = $scope.counts.roi_species_counts.reduce(function (count, current) {
      return count = count + current.N;
    }, 0);
    all_species = {
      species_id: 0,
      N: count_all_species,
      scientific_name: "All Species"
    };
    $scope.counts.roi_species_counts.unshift(all_species); //$scope.counts.roi_species_counts.unshift($scope.selected.species);

    var count_all_sites = $scope.counts.roi_sites_counts.reduce(function (count, current) {
      return count = count + current.N;
    }, 0);
    var all_site = {
      site_id: 0,
      N: count_all_sites,
      name: "All Sites"
    };
    $scope.counts.roi_sites_counts.unshift(all_site);
    $scope.selected.species = $scope.counts.roi_species_counts.find(function (element) {
      return element.species_id == $scope.selected.species.species_id;
    });
    $scope.selected.site = $scope.counts.roi_sites_counts.find(function (element) {
      return element.site_id == $scope.selected.site.site_id;
    });
    $scope.total = {
      rois: site.N,
      pages: Math.ceil(site.N / $scope.limit)
    };
    loadROIPage();
  };

  var loadROIPage = function () {
    $scope.loading = true;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    a2CNN.listROIs($scope.cnnId, $scope.limit, $scope.offset, $scope.selected.species.species_id, $scope.selected.site.site_id, $scope.selected.search.value).then(function (data) {
      $scope.resultsROIs = data;
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
      $scope.infopanedata = "";
      $scope.rois = byROIs($scope.resultsROIs);
      $scope.rois_species = byROIsbySpecies($scope.rois, $scope.selected.search.value === 'by_score_per_site');
    });
  };

  $scope.validate = function () {
    if (!a2UserPermit.can('validate cnn rois')) {
      notify.log('You do not have permission to validate the cnn rois.');
      return;
    }

    var validation = ($scope.validation.current || {
      value: null
    }).value;
    var rois = [];

    for (var species in $scope.rois_species) {
      $scope.rois_species[species].rois.forEach(function (roi) {
        if (roi.selected) {
          rois.push(roi);
        }
      });
    }

    var roiIds = rois.map(function (roi) {
      return roi.cnn_result_roi_id;
    });

    try {
      a2CNN.validateRois($scope.cnnId, roiIds, validation).then(function (response) {
        rois.forEach(function (roi) {
          roi.validated = validation;
          roi.selected = false;
        }); //loadROIPage();
      });
    } catch (error) {
      console.error("TCL: $scope.validate -> error", error);
    }

    refreshDetails();
  }; //$scope.calcWidth = function(roi) {
  //};


  $scope.onScroll = function ($event, $controller) {
    this.scrollElement = $controller.scrollElement;
    var scrollPos = $controller.scrollElement.scrollY;
    var headerTop = $controller.anchors.header.offset().top;
    this.headerTop = headerTop | 0;
    this.scrolledPastHeader = scrollPos >= headerTop;
  };

  var getSpeciesCounts = function (site, species_sites_matrix) {
    if (site == 0) {
      site = 'total';
    }

    var roi_species_counts = [];
    species_sites_matrix.forEach(function (species) {
      roi_species_counts.push({
        species_id: species.species_id,
        N: species[site],
        scientific_name: species.scientific_name
      });
    });
    return roi_species_counts;
  };

  var getSitesCounts = function (species, species_sites_matrix) {
    if (species == 0) {
      species = 'total';
    }

    var roi_site_counts = [];
    species_sites_matrix.forEach(function (s) {
      if (species == 'total' | s.species_id == species) {
        for (key in s) {
          split = key.split("_");
          site_id = split[1];
          name = split.slice(2).join("_");

          if (split[0] == "site") {
            row = {};
            row.site_id = site_id;
            row.N = s[key];
            row.name = name;
            roi_site_counts.push(row);
          }
        }
      }
    });

    if (species == 'total') {
      roi_site_counts_dict = roi_site_counts.reduce(function (sitesAcc, site) {
        if (!(site.site_id in sitesAcc)) {
          sitesAcc[site.site_id] = {
            site_id: site.site_id,
            N: 0,
            name: site.name
          };
        }

        sitesAcc[site.site_id].N += site.N;
        return sitesAcc;
      }, {});
      roi_site_counts = Object.values(roi_site_counts_dict);
    }

    return roi_site_counts;
  };

  $scope.onSearchChanged = function () {
    $scope.switchView("rois");
  };

  $scope.switchView = function (viewType, specie) {
    if (specie) {
      window.scrollTo(0, 0);
    }

    var sortBy = "-cnn_presence_id";

    var loadSwitch = function () {
      if (viewType == "species") {
        $scope.species = bySpecies($scope.results);
        $scope.viewType = "species";
        sortBy = "-scientific_name";
        $scope.showHist(specie ? specie : "all");
        $scope.cnnOriginal = Object.values($scope.species);
      } else if (viewType == "recordings") {
        $scope.recordings = byRecordings($scope.results);
        $scope.counts.recordings = Object.keys($scope.recordings).length;
        $scope.viewType = "recordings";
        sortBy = "-recording_id";
        $scope.cnnOriginal = Object.values($scope.recordings);
      } else {
        $scope.viewType = "all";
        $scope.mainResults = $scope.results;
        $scope.cnnOriginal = Object.values($scope.results);
      }

      if ($scope.cnnOriginal.length > 0) {
        initTable(1, 10, sortBy, {}, $scope.cnnOriginal.length);
      } else {
        $scope.infopanedata = "No cnn results found.";
      }
    };

    if (viewType == "rois") {
      a2CNN.countROIsBySpeciesSites($scope.cnnId, {
        search: $scope.selected.search.value
      }).then(function (response) {
        var data = response.data;
        $scope.roi_species_sites_counts = data;
        $scope.counts.roi_species_counts = getSpeciesCounts($scope.selected.site ? $scope.selected.site.site_id : 0, $scope.roi_species_sites_counts);
        $scope.counts.roi_sites_counts = getSitesCounts($scope.selected.species ? $scope.selected.species.species_id : 0, $scope.roi_species_sites_counts);
        var count_all = $scope.counts.roi_species_counts.reduce(function (count, current) {
          return count = count + current.N;
        }, 0);
        var all_species = {
          species_id: 0,
          N: count_all,
          scientific_name: "All Species"
        };
        $scope.counts.roi_species_counts.unshift(all_species);

        if (!$scope.selected.species) {
          $scope.selected.species = all_species;
        } else {
          $scope.selected.species = $scope.counts.roi_species_counts.find(function (element) {
            return element.species_id == $scope.selected.species.species_id;
          }) || all_species;
        }

        var all_sites = {
          site_id: 0,
          N: count_all,
          name: "All Sites"
        };
        $scope.counts.roi_sites_counts.unshift(all_sites);

        if (!$scope.selected.site) {
          $scope.selected.site = all_sites;
        } else {
          $scope.selected.site = $scope.counts.roi_sites_counts.find(function (element) {
            return element.site_id == $scope.selected.site.site_id;
          }) || all_sites;
        }

        $scope.total = {
          rois: count_all,
          pages: Math.ceil(count_all / $scope.limit)
        };
        $scope.viewType = "rois";
        loadROIPage();
      }); //$scope.viewType = "rois";
      //if (!$scope.resultsROIs) {
      //    loadROIPage();
      //} else {
      //    $scope.rois = byROIs($scope.resultsROIs);
      //    $scope.rois_species = byROIsbySpecies($scope.rois);
      //}
    } else if (!$scope.results) {
      $scope.loading = true;
      $scope.infoInfo = "Loading...";
      $scope.showInfo = true;
      a2CNN.listResults($scope.cnnId).then(function (data) {
        $scope.results = data;
        $scope.infoInfo = "";
        $scope.showInfo = false;
        $scope.loading = false;
        $scope.infopanedata = "";
        $scope.switchView('rois'); //loadSwitch();
      });
    } else {
      loadSwitch();
    }
  };

  $scope.switchView($state.params.detailType ? $state.params.detailType : 'all');
}]);
angular.module('a2.analysis.patternmatching', ['ui.bootstrap', 'a2.directive.audio-bar', 'a2.srv.patternmatching', 'a2.services', 'a2.permissions', 'humane', 'c3-charts']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('analysis.disabled-patternmatching', {
    url: '/disabled/patternmatching',
    templateUrl: '/app/analysis/patternmatching/disabled.html'
  });
  $stateProvider.state('analysis.patternmatching', {
    url: '/patternmatching?newJob',
    controller: 'PatternMatchingCtrl',
    templateUrl: '/app/analysis/patternmatching/list.html'
  });
  $stateProvider.state('analysis.patternmatching-details', {
    url: '/patternmatching/:patternMatchingId',
    controller: 'PatternMatchingCtrl',
    templateUrl: '/app/analysis/patternmatching/list.html'
  });
}]).controller('PatternMatchingCtrl', ["$scope", "$modal", "JobsData", "$location", "notify", "a2PatternMatching", "a2UserPermit", "$state", "$stateParams", function ($scope, $modal, JobsData, $location, notify, a2PatternMatching, a2UserPermit, $state, $stateParams) {
  $scope.selectedPatternMatchingId = $stateParams.patternMatchingId;
  $scope.loading = {
    rows: false,
    showRefreshBtn: false
  };
  $scope.paginationSettings = {
    page: 1,
    limit: 10,
    offset: 0,
    totalJobs: 0,
    totalPages: 0
  };
  $scope.search = {
    q: ''
  };
  var timeout;
  var p = $state.params;
  var isNewJob = p && p.newJob !== undefined;
  $scope.getTemplateVisualizerUrl = function (template) {
    var box;

    if (template && template.x1) {
      box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
    }

    return template ? "/project/" + template.source_project_uri + "/visualizer/rec/" + template.recording + "?a=" + box : '';
  }, $scope.selectItem = function (patternmatchingId) {
    $scope.selectedPatternMatchingId = patternmatchingId;

    if (!patternmatchingId) {
      $state.go('analysis.patternmatching', {});
    } else {
      $state.go('analysis.patternmatching-details', {
        patternMatchingId: patternmatchingId
      });
    }
  };

  $scope.setCurrentPage = function () {
    this.paginationSettings.offset = $scope.paginationSettings.page - 1;
    $scope.loadPatternMatchings();
  };

  $scope.update = function (patternMatching, $event) {
    $event.stopPropagation();

    if (!a2UserPermit.can('manage pattern matchings')) {
      notify.error('You do not have permission to edit pattern matchings');
      return;
    }

    $scope.pmName = patternMatching.name;
    const modalInstance = $modal.open({
      templateUrl: '/app/analysis/patternmatching/edit-patternmatching.html',
      scope: $scope
    });
    modalInstance.result.then(function (name) {
      a2PatternMatching.update(patternMatching.id, {
        name: name
      }).then(function () {
        $scope.loadPatternMatchings();
      });
    });
  };

  $scope.loadPatternMatchings = function () {
    $scope.loading.rows = true;
    $scope.showInfo = true;
    $scope.splitAllSites = false;
    return a2PatternMatching.list({
      completed: true,
      q: $scope.search.q,
      limit: $scope.paginationSettings.limit,
      offset: $scope.paginationSettings.offset * $scope.paginationSettings.limit
    }).then(function (data) {
      $scope.patternmatchingsOriginal = data.list;
      $scope.patternmatchingsData = data.list;
      $scope.paginationSettings.totalJobs = data.count;
      $scope.paginationSettings.totalPages = Math.ceil($scope.paginationSettings.totalJobs / $scope.paginationSettings.limit);
      $scope.showInfo = false;
      $scope.loading.rows = false;

      if (data && data.list.length) {
        $scope.loading.showRefreshBtn = true;
      }
    });
  };

  $scope.onFilterChanged = function () {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      if ($scope.search.q.trim().length > 0 && $scope.search.q.trim().length < 4) return;
      $scope.resetPagination();
      $scope.loadPatternMatchings();
    }, 1000);
  };

  $scope.isShowSearch = function () {
    return $scope.patternmatchingsData && $scope.patternmatchingsData.length || $scope.search.q.trim().length > 0;
  };

  $scope.resetPagination = function () {
    $scope.paginationSettings.page = 1;
    $scope.paginationSettings.offset = 0;
    $scope.paginationSettings.totalJobs = 0;
    $scope.paginationSettings.totalPages = 0;
  };

  $scope.createNewPatternMatching = function () {
    if (!a2UserPermit.can('manage pattern matchings')) {
      notify.error('You do not have permission to create pattern matchings');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/patternmatching/createnewpatternmatching.html',
      controller: 'CreateNewPatternMatchingInstanceCtrl as controller'
    });
    modalInstance.result.then(function (result) {
      data = result;

      if (data.ok) {
        JobsData.updateJobs();
        $scope.loading.showRefreshBtn = true;
        notify.log("Your new pattern matching is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
      } else if (data.error) {
        notify.error("Error: " + data.error);
      } else if (data.url) {
        $location.path(data.url);
      }
    });
  };

  if (isNewJob) {
    $scope.createNewPatternMatching();
  }

  $scope.deletePatternMatching = function (patternMatching, $event) {
    $event.stopPropagation();

    if (!a2UserPermit.can('manage pattern matchings')) {
      notify.error('You do not have permission to delete pattern matchings');
      return;
    }

    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/patternmatching/deletepatternmatching.html',
      controller: 'DeletePatternMatchingInstanceCtrl as controller',
      resolve: {
        patternMatching: function () {
          return patternMatching;
        }
      }
    });
    modalInstance.result.then(function (ret) {
      if (ret.err) {
        notify.error("Error: " + ret.err);
      } else {
        var index = -1;
        var modArr = angular.copy($scope.patternmatchingsOriginal);

        for (var i = 0; i < modArr.length; i++) {
          if (modArr[i].id === patternMatching.id) {
            index = i;
            break;
          }
        }

        if (index > -1) {
          $scope.patternmatchingsOriginal.splice(index, 1);
          notify.log("PatternMatching deleted successfully");
        }
      }
    });
  };

  if (!$scope.selectedPatternMatchingId) {
    $scope.loadPatternMatchings();
  }
}]).directive('a2PatternMatchingDetails', function () {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      patternMatchingId: '=',
      onGoBack: '&'
    },
    controller: 'PatternMatchingDetailsCtrl',
    controllerAs: 'controller',
    templateUrl: '/app/analysis/patternmatching/details.html'
  };
}).controller('PatternMatchingDetailsCtrl', ["$scope", "$q", "a2PatternMatching", "a2Templates", "a2UserPermit", "Project", "a2AudioBarService", "notify", "$anchorScroll", "$modal", function ($scope, $q, a2PatternMatching, a2Templates, a2UserPermit, Project, a2AudioBarService, notify, $anchorScroll, $modal) {
  Object.assign(this, {
    id: null,
    initialize: function (patternMatchingId) {
      this.id = patternMatchingId;
      this.offset = 0;
      this.limit = 100;
      this.selected = {
        roi_index: 0,
        roi: null,
        page: 1
      };
      this.sitesList = [];
      this.sitesListBatchSize = 20;
      this.sitesBatches = [];
      this.total = {
        rois: 0,
        pages: 0
      };
      this.paginationTotal = 0;
      this.loading = {
        details: false,
        rois: true
      };
      this.validation = this.lists.validation[2];
      this.thumbnailClass = this.lists.thumbnails[0].value;
      this.search = this.lists.search[6];
      this.projecturl = Project.getUrl();
      this.fetchDetails().then(function () {
        return this.loadSitesList();
      }.bind(this)).then(function () {
        return this.loadData(1);
      }.bind(this));
    },
    lists: {
      thumbnails: [{
        class: 'fa fa-th-large',
        value: ''
      }, {
        class: 'fa fa-th',
        value: 'is-small'
      }],
      search: [{
        value: 'all',
        text: 'All',
        description: 'Show all matched Region of Interest.'
      }, {
        value: 'present',
        text: 'Present',
        description: 'Show all Region of Interest marked as present.'
      }, {
        value: 'not_present',
        text: 'Not Present',
        description: 'Show all Region of Interest marked as not present.'
      }, {
        value: 'unvalidated',
        text: 'Unvalidated',
        description: 'Show all Region of Interest without validation.'
      }, {
        value: 'best_per_site',
        text: 'Best per Site',
        description: 'Show the best scored roi per site.'
      }, {
        value: 'best_per_site_day',
        text: 'Best per Site, Day',
        description: 'Show the best scored roi per site and day.'
      }, {
        value: 'by_score',
        text: 'Score',
        description: 'Show all Region of Interest ranked by score.'
      }, {
        value: 'by_score_per_site',
        text: 'Score per Site',
        description: 'Show all Region of Interest ranked by score per site.'
      }, {
        value: 'top_200_per_site',
        text: '200 Top Scores per Site',
        description: 'Show Top 200 Region of Interest ranked by score per each site.'
      }],
      selection: [{
        value: 'all',
        text: 'All'
      }, {
        value: 'none',
        text: 'None'
      }, {
        value: 'not-validated',
        text: 'Not Validated'
      }],
      validation: [{
        class: "fa val-1",
        text: "Present",
        value: 1
      }, {
        class: "fa val-0",
        text: "Not Present",
        value: 0
      }, {
        class: "fa val-null",
        text: "Clear",
        value: null
      }]
    },
    fetchDetails: function () {
      this.loading.details = true;
      return a2PatternMatching.getDetailsFor(this.id).then(function (patternMatching) {
        this.loading.details = false;
        this.patternMatching = patternMatching;
        this.patternMatching.templateParameters = {
          'Threshold': this.patternMatching.parameters.threshold,
          'Matches/Recording': this.patternMatching.parameters.N,
          'Matches/Site': this.patternMatching.parameters.persite || 'no limit'
        };
        this.total = {
          rois: patternMatching.matches,
          pages: Math.ceil(patternMatching.matches / this.limit)
        };
      }.bind(this)).catch(function (err) {
        this.loading.details = false;
        return notify.serverError(err);
      }.bind(this));
    },
    onSearchChanged: function () {
      this.selected.page = 1;
      this.recalculateSiteListBatch();
      this.loadData(1);
    },
    update: function (patternMatching, $event) {
      const self = this;
      $event.stopPropagation();

      if (!a2UserPermit.can('manage pattern matchings')) {
        notify.error('You do not have permission to edit pattern matchings');
        return;
      }

      $scope.pmName = patternMatching.name;
      const modalInstance = $modal.open({
        templateUrl: '/app/analysis/patternmatching/edit-patternmatching.html',
        scope: $scope
      });
      modalInstance.result.then(function (name) {
        a2PatternMatching.update(patternMatching.id, {
          name: name
        }).then(function () {
          patternMatching.name = name;
        });
      });
    },
    setupExportUrl: function () {
      const speciesName = this.patternMatching.species_name.replace(/\s+/g, '_').toLowerCase();
      const songtypeName = this.patternMatching.songtype_name.replace(/\s+/g, '_').toLowerCase();
      const fileName = 'pm-' + this.patternMatching.species_id + '-' + speciesName + '-' + songtypeName;
      this.patternMatchingExportUrl = a2PatternMatching.getExportUrl({
        patternMatching: this.patternMatching.id,
        fileName: encodeURIComponent(fileName)
      });
    },
    exportPmReport: function ($event) {
      $event.stopPropagation();
      if (a2UserPermit.isSuper()) return this.setupExportUrl();

      if (a2UserPermit.all && !a2UserPermit.all.length || !a2UserPermit.can('export report')) {
        return notify.error('You do not have permission to export Pattern Matching data');
      } else return this.setupExportUrl();
    },
    onScroll: function ($event, $controller) {
      if (this.search.value === 'by_score_per_site') {
        return false;
      }

      this.scrollElement = $controller.scrollElement;
      var scrollPos = $controller.scrollElement.scrollY;
      var headerTop = $controller.anchors.header.offset().top;
      this.headerTop = headerTop | 0;
      this.scrolledPastHeader = scrollPos >= headerTop;
    },
    onSelect: function ($item) {
      this.select($item.value);
    },
    loadSitesList: function () {
      return a2PatternMatching.getSitesListFor(this.id).then(function (list) {
        this.sitesList = list;
        this.sitesTotal = this.sitesBatches.length;
        this.splitSitesListIntoBatches();
      }.bind(this));
    },
    splitSitesListIntoBatches: function () {
      var batches = [];

      for (var i = 0; i < this.sitesList.length; i += this.sitesListBatchSize) {
        batches.push(this.sitesList.slice(i, i + this.sitesListBatchSize));
      }

      this.sitesBatches = batches;
    },
    getCountPerSite: function () {
      return this.rois && this.rois[0] && this.rois[0].list[0].countPerSite;
    },
    recalculateTotalItems: function () {
      var search = this.search && this.search.value ? this.search.value : undefined;

      switch (search) {
        case 'present':
          this.paginationTotal = this.patternMatching.present;
          break;

        case 'not_present':
          this.paginationTotal = this.patternMatching.absent;
          break;

        case 'by_score':
          this.paginationTotal = this.patternMatching.matches;
          break;

        case 'by_score_per_site':
          this.paginationTotal = this.getCountPerSite();
          break;

        default:
          this.paginationTotal = 0;
      }
    },
    recalculateSiteListBatch: function () {
      var search = this.search && this.search.value ? this.search.value : undefined;
      var shouldRecalculate = false;

      if (['all', 'unvalidated', 'top_200_per_site', 'by_score_per_site'].includes(search)) {
        if (this.sitesListBatchSize !== 1) {
          shouldRecalculate = true;
        }

        this.sitesListBatchSize = 1;
      } else if (['best_per_site', 'best_per_site_day'].includes(search)) {
        if (this.sitesListBatchSize !== 10) {
          shouldRecalculate = true;
        }

        this.sitesListBatchSize = 10;
      }

      if (shouldRecalculate) {
        this.splitSitesListIntoBatches();
      }
    },
    setSiteBookmark: function (site) {
      const scorePerSite = this.search.value === 'by_score_per_site';

      if (this.shouldGetPerSite() || scorePerSite) {
        this.selected.page = scorePerSite ? 1 : this.getSiteBatchIndexBySiteId(site.site_id) + 1;
        return this.loadData();
      }

      var bookmark = 'site-' + site.site_id;
      $anchorScroll.yOffset = $('.a2-page-header').height() + 60;
      $anchorScroll(bookmark);
    },
    shouldGetPerSite: function () {
      return this.search && ['all', 'unvalidated', 'top_200_per_site', 'best_per_site', 'best_per_site_day'].includes(this.search.value);
    },
    getSiteBatchIndexBySiteId: function (siteId) {
      if (!this.sitesBatches || !this.sitesBatches.length) {
        return undefined;
      }

      return this.sitesBatches.findIndex(function (batch) {
        return !!batch.find(function (site) {
          return site.site_id === siteId;
        });
      });
    },
    getSiteBatchBySiteId: function (siteId) {
      const batchIndex = this.getSiteBatchIndexBySiteId(siteId);

      if (batchIndex === undefined) {
        return undefined;
      }

      return this.sitesBatches[batchIndex];
    },
    getSiteBatchByPageNumber: function (page) {
      if (!this.sitesBatches || !this.sitesBatches.length) {
        return undefined;
      }

      return this.sitesBatches[page - 1];
    },
    combOpts: function (data) {
      var search = this.search && this.search.value ? this.search.value : undefined;
      var opts = {
        search: search
      };

      if (data.site) {
        opts.site = data.site;
      }

      if (data.sites) {
        opts.sites = data.sites;
      }

      var limit, offset;
      const doubleLimit = 200;
      const offsetCalc = offset = (data.pageNumber - 1) * this.limit;

      switch (search) {
        case 'top_200_per_site':
          limit = doubleLimit;
          offset = 0;
          break;

        case 'best_per_site':
          limit = 1;
          offset = 0;
          break;

        case 'all':
        case 'unvalidated':
          limit = 100000000;
          offset = 0;
          break;

        default:
          limit = this.limit;
          offset = offsetCalc;
      }

      return {
        limit: limit,
        offset: offset,
        opts: opts
      };
    },
    parseRoisResult: function (rois) {
      var search = this.search && this.search.value ? this.search.value : undefined;
      this.splitAllSites = search === 'by_score';

      if (this.splitAllSites) {
        return [{
          list: rois
        }];
      } else {
        return rois.reduce(function (_, roi) {
          var site_id = roi.site_id;
          var sitename = roi.site;

          if (!_.idx[sitename]) {
            _.idx[sitename] = {
              list: [],
              idx: {},
              name: sitename,
              id: site_id
            };

            _.list.push(_.idx[sitename]);
          }

          var site = _.idx[sitename];
          site.list.push(roi);
          return _;
        }, {
          list: [],
          idx: {}
        }).list;
      }
    },
    loadData: function (page) {
      var params;

      if (this.search.value === 'by_score_per_site') {
        const site = this.selected.siteBookmark ? this.selected.siteBookmark.site_id : this.sitesBatches[0][0].site_id;
        params = this.combOpts({
          sites: site,
          pageNumber: this.selected.page
        });
      } else if (this.shouldGetPerSite()) {
        page = page || this.selected.page;
        var siteBatch = this.getSiteBatchByPageNumber(page);
        var siteIds = siteBatch.map(function (s) {
          return s.site_id;
        });
        params = this.combOpts({
          sites: siteIds
        });
      } else {
        params = this.combOpts({
          pageNumber: this.selected.page
        });
      }

      this.rois = [];
      this.loading.rois = true;
      return a2PatternMatching.getRoisFor(this.id, params.limit, params.offset, params.opts).then(function (rois) {
        this.loading.rois = false;
        this.rois = this.parseRoisResult(rois);
        this.selected.roi = Math.min();
        this.recalculateTotalItems();
      }.bind(this)).catch(function (err) {
        this.loading.rois = false;
        return notify.serverError(err);
      }.bind(this));
    },
    playRoiAudio: function (roi, $event) {
      if ($event) {
        $event.preventDefault();
        $event.stopPropagation();
      }

      console.info('play');
      a2AudioBarService.loadUrl(a2PatternMatching.getAudioUrlFor(roi), true);
    },
    playTemplateAudio: function () {
      a2AudioBarService.loadUrl(a2Templates.getAudioUrlFor(this.patternMatching.template), true);
    },
    getRoiVisualizerUrl: function (roi) {
      var box = ['box', roi.x1, roi.y1, roi.x2, roi.y2].join(',');
      return roi ? "/project/" + this.projecturl + "/visualizer/rec/" + roi.recording_id + "?a=" + box : '';
    },
    getTemplateVisualizerUrl: function (template) {
      var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
      return template ? "/project/" + template.source_project_uri + "/visualizer/rec/" + template.recording + "?a=" + box : '';
    },
    setRoi: function (roi_index) {
      if (this.total.rois <= 0) {
        this.selected.roi_index = 0;
        this.selected.roi = null;
      } else {
        this.selected.roi_index = Math.max(0, Math.min(roi_index | 0, this.total.rois - 1));
        this.selected.roi = this.rois[this.selected.roi_index];
      }

      return this.selected.roi;
    },
    setPage: function (page, force) {
      if (this.total.rois <= 0) {
        this.selected.page = 1;
        this.rois = [];
        return $q.resolve(this.rois);
      } else {
        if (page != this.selected.page || force) {
          this.selected.page = page;
          return this.loadData(page);
        }
      }

      return $q.resolve();
    },
    select: function (option) {
      var selectFn = null;

      if (option === "all") {
        selectFn = function (roi) {
          roi.selected = true;
        };
      } else if (option === "none") {
        selectFn = function (roi) {
          roi.selected = false;
        };
      } else if (option === "not-validated") {
        selectFn = function (roi) {
          roi.selected = roi.validated === null;
        };
      } else {
        selectFn = function (roi) {
          roi.selected = roi.id === option;
        };
      }

      this.forEachRoi(selectFn);
    },
    forEachRoi: function (fn) {
      (this.rois || []).forEach(function (site) {
        site.list.forEach(fn);
      });
    },
    validate: function (validation, rois) {
      if (!a2UserPermit.can('validate pattern matchings')) {
        notify.error('You do not have permission to validate the matched rois.');
        return;
      }

      if (validation === undefined) {
        validation = (this.validation || {
          value: null
        }).value;
      }

      if (rois === undefined) {
        rois = [];
        this.forEachRoi(function (roi) {
          if (roi.selected) {
            rois.push(roi);
          }
        });
      }

      var roiIds = rois.map(function (roi) {
        return roi.id;
      });
      var val_delta = {
        0: 0,
        1: 0,
        null: 0
      };
      var cls = {
        species: this.patternMatching.species_name,
        songtype: this.patternMatching.songtype_name
      };
      return a2PatternMatching.validateRois(this.id, roiIds, validation, cls).then(function () {
        rois.forEach(function (roi) {
          val_delta[roi.validated] -= 1;
          val_delta[validation] += 1;
          roi.validated = validation;
          roi.selected = false;
        });
        this.patternMatching.absent += val_delta[0];
        this.patternMatching.present += val_delta[1];
      }.bind(this));
    }
  });
  this.initialize($scope.patternMatchingId);
}]).controller('DeletePatternMatchingInstanceCtrl', ["$scope", "$modalInstance", "a2PatternMatching", "patternMatching", function ($scope, $modalInstance, a2PatternMatching, patternMatching) {
  this.patternMatching = patternMatching;
  $scope.deletingloader = false;

  $scope.ok = function () {
    $scope.deletingloader = true;
    a2PatternMatching.delete(patternMatching.id).then(function (data) {
      $modalInstance.close(data);
    });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]).controller('CreateNewPatternMatchingInstanceCtrl', ["$modalInstance", "a2PatternMatching", "a2Templates", "a2Playlists", "notify", function ($modalInstance, a2PatternMatching, a2Templates, a2Playlists, notify) {
  var self = this;
  Object.assign(this, {
    initialize: function () {
      this.loading = {
        playlists: false,
        templates: false,
        createPatternMatching: false
      };
      this.data = {
        name: null,
        playlist: null,
        template: null,
        params: {
          N: 1,
          threshold: 0.3
        }
      };
      this.list = {};
      this.loading = {
        templates: true,
        playlists: true
      };
      this.isSaving = false;
      this.warningMessage = 'Warning: Large playlist (500,000+ recordings). Save resources by reducing playlist size.';
      this.getTemplates();
      this.getPlaylists();
    },
    getTemplates: function () {
      self.loading.templates = true;
      return a2Templates.getList().then(function (templates) {
        self.loading = false;
        self.list.templates = templates.filter(function (t) {
          return !t.disabled;
        });
      }.bind(this)).catch(function (err) {
        self.loading = false;
        self.list.templates = [];
        notify.serverError(err);
      }.bind(this));
    },
    getPlaylists: function () {
      self.loading.playlists = true;
      return a2Playlists.getList().then(function (playlists) {
        self.playlists = false;
        self.list.playlists = playlists;
      }.bind(this)).catch(function (err) {
        self.playlists = false;
        self.list.playlists = [];
        notify.serverError(err);
      }.bind(this));
    },
    ok: function () {
      if (self.data.playlist.count === 0) {
        return notify.error('Note: The playlist should not be empty.');
      }

      self.isSaving = true;
      return a2PatternMatching.create({
        name: self.data.name,
        playlist: self.data.playlist.id,
        template: self.data.template.id,
        params: self.data.params
      }).then(function (patternMatching) {
        self.isSaving = false;
        $modalInstance.close({
          ok: true,
          patternMatching: patternMatching
        });
      }).catch(function (err) {
        console.log('err', err);
        self.isSaving = false;
        notify.error(err);
      });
    },
    isJobValid: function () {
      return self.data && self.data.name && self.data.name.length > 3 && self.data.playlist && self.data.template;
    },
    cancel: function (url) {
      $modalInstance.close({
        cancel: true,
        url: url
      });
    },
    isWarningMessage: function () {
      return this.data.playlist && this.data.playlist.count > 500000;
    }
  });
  this.initialize();
}]);
angular.module('a2.analysis.random-forest-models', ['ui.router', 'a2.analysis.random-forest-models.models', 'a2.analysis.random-forest-models.classification']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('analysis.random-forest-models', {
    url: '/random-forest-models',
    template: '<ui-view />',
    abstract: true
  });
}]);
angular.module('a2.analysis.soundscapes', ['a2.services', 'a2.permissions', 'ui.bootstrap', 'ui-rangeSlider', 'ngCsv']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('analysis.soundscapes', {
    url: '/soundscapes?newJob',
    controller: 'SoundscapesCtrl as controller',
    templateUrl: '/app/analysis/soundscapes/list.html'
  });
}]).controller('SoundscapesCtrl', ["$window", "$scope", "$modal", "$filter", "Project", "JobsData", "ngTableParams", "a2Playlists", "$location", "a2Soundscapes", "notify", "a2UserPermit", "$state", function ($window, $scope, $modal, $filter, Project, JobsData, ngTableParams, a2Playlists, $location, a2Soundscapes, notify, a2UserPermit, $state) {
  var $ = $window.$;
  $scope.successInfo = "";
  $scope.showSuccess = false;
  $scope.errorInfo = "";
  $scope.showError = false;
  $scope.infoInfo = "Loading...";
  $scope.showInfo = true;
  $scope.loading = true;
  var p = $state.params;
  var isNewJob = p && p.newJob !== undefined;
  $scope.infopanedata = '';
  Project.getInfo(function (data) {
    $scope.projectData = data;
    $scope.pid = data.project_id;
    $scope.url = data.url;
    $scope.isProjectDisabled = data.disabled === 1;
  });
  a2Playlists.getList().then(function (data) {
    $scope.playlists = data;
  });

  var initTable = function (p, c, s, f, t) {
    var sortBy = {};
    var acsDesc = 'desc';

    if (s[0] == '+') {
      acsDesc = 'asc';
    }

    sortBy[s.substring(1)] = acsDesc;
    $scope.tableParams = new ngTableParams({
      page: p,
      count: c,
      sorting: sortBy,
      filter: f
    }, {
      total: t,
      getData: function ($defer, params) {
        $scope.infopanedata = "";
        var filteredData = params.filter() ? $filter('filter')($scope.soundscapesOriginal, params.filter()) : $scope.soundscapesOriginal;
        var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.soundscapesOriginal;
        params.total(orderedData.length);
        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

        if (orderedData.length < 1) {
          $scope.infopanedata = "No classifications found.";
        }

        $scope.soundscapesData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
        a2Soundscapes.saveState({
          'data': $scope.soundscapesOriginal,
          'filtered': $scope.soundscapesData,
          'f': params.filter(),
          'o': params.orderBy(),
          'p': params.page(),
          'c': params.count(),
          't': orderedData.length
        });
      }
    });
  };

  $scope.loadSoundscapes = function () {
    a2Soundscapes.getList2(function (data) {
      $scope.soundscapesOriginal = data;
      $scope.soundscapesData = data;
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
      $scope.infopanedata = "";

      if (data.length > 0) {
        if (!$scope.tableParams) {
          initTable(1, 10, "+name", {}, data.length);
        } else {
          $scope.tableParams.reload();
        }
      } else {
        $scope.infopanedata = "No soundscapes found.";
      }
    });
  };

  var stateData = a2Soundscapes.getState();

  if (stateData === null) {
    $scope.loadSoundscapes();
  } else {
    if (stateData.data.length > 0) {
      $scope.soundscapesData = stateData.filtered;
      $scope.soundscapesOriginal = stateData.data;
      initTable(stateData.p, stateData.c, stateData.o[0], stateData.f, stateData.filtered.length);
    } else {
      $scope.infopanedata = "No models found.";
    }

    $scope.infoInfo = "";
    $scope.showInfo = false;
    $scope.loading = false;
  }

  $scope.deleteSoundscape = function (id, name) {
    if (!a2UserPermit.can('manage soundscapes')) {
      notify.error('You do not have permission to delete soundscapes');
      return;
    }

    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.loading = true;
    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/soundscapes/deletesoundscape.html',
      controller: 'DeleteSoundscapeInstanceCtrl',
      resolve: {
        name: function () {
          return name;
        },
        id: function () {
          return id;
        },
        projectData: function () {
          return $scope.projectData;
        }
      }
    });
    modalInstance.opened.then(function () {
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
    });
    modalInstance.result.then(function (ret) {
      if (ret.error) {
        notify.error("Error: " + ret.error);
      } else {
        var index = -1;
        var modArr = angular.copy($scope.soundscapesOriginal);

        for (var i = 0; i < modArr.length; i++) {
          if (modArr[i].soundscape_id === id) {
            index = i;
            break;
          }
        }

        if (index > -1) {
          $scope.soundscapesOriginal.splice(index, 1);
          $scope.tableParams.reload();
          notify.log("Soundscape deleted successfully");
        }
      }
    });
  };

  $scope.createNewSoundscape = function () {
    if (!a2UserPermit.can('manage soundscapes')) {
      notify.error('You do not have permission to create soundscapes');
      return;
    }

    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.loading = true;
    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/soundscapes/createnewsoundscape.html',
      controller: 'CreateNewSoundscapeInstanceCtrl',
      resolve: {
        amplitudeReferences: ["a2Soundscapes", function (a2Soundscapes) {
          return a2Soundscapes.getAmplitudeReferences();
        }],
        playlists: function () {
          return $scope.playlists;
        },
        projectData: function () {
          return $scope.projectData;
        }
      }
    });
    modalInstance.opened.then(function () {
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
    });
    modalInstance.result.then(function (result) {
      data = result;

      if (data.ok) {
        JobsData.updateJobs();
        notify.log("Your new soundscape is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
      }

      if (data.err) {
        notify.error(data.err);
      }

      if (data.url) {
        $location.path(data.url);
      }
    });
  };

  if (isNewJob) {
    $scope.createNewSoundscape();
  }

  $scope.showDetails = function (soundscapeId) {
    a2Soundscapes.get(soundscapeId, function (soundscape) {
      a2Playlists.getInfo(soundscape.playlist_id, function (plist) {
        var modalInstance = $modal.open({
          controller: 'SoundscapesDetailsCtrl as controller',
          templateUrl: '/app/analysis/soundscapes/details.html',
          resolve: {
            soundscape: function () {
              return soundscape;
            },
            playlist: function () {
              return plist;
            }
          }
        });
      });
    });
  };

  this.exportSoundscape = function (options) {
    if (a2UserPermit.isSuper()) return this.getExportUrl(options);

    if (a2UserPermit.all && !a2UserPermit.all.length || !a2UserPermit.can('export report')) {
      return notify.error('You do not have permission to export soundscape data');
    }

    this.getExportUrl(options);
  };

  this.getExportUrl = function (options) {
    a2Soundscapes.getExportUrl(options).then(function (export_url) {
      var a = $('<a></a>').attr('target', '_blank').attr('href', export_url).appendTo('body');
      $window.setTimeout(function () {
        a[0].click();
        a.remove();
      }, 0);
    });
  };
}]).controller('DeleteSoundscapeInstanceCtrl', ["$scope", "$modalInstance", "a2Soundscapes", "name", "id", "projectData", function ($scope, $modalInstance, a2Soundscapes, name, id, projectData) {
  $scope.name = name;
  $scope.id = id;
  $scope.projectData = projectData;
  var url = $scope.projectData.url;

  $scope.ok = function () {
    a2Soundscapes.delete(id, function (data) {
      $modalInstance.close(data);
    });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]).controller('CreateNewSoundscapeInstanceCtrl', ["$scope", "$modalInstance", "a2Soundscapes", "$timeout", "projectData", "playlists", function ($scope, $modalInstance, a2Soundscapes, $timeout, projectData, playlists) {
  $scope.projectData = projectData;
  $scope.playlists = playlists;
  $scope.buttonEnableFlag = true;
  $scope.datasubmit = {
    name: '',
    playlist: '',
    aggregation: '',
    threshold: 0,
    thresholdReference: 'absolute',
    bin: 86,
    bandwidth: 0,
    normalize: false
  };
  $scope.nameMsg = '';

  $scope.aggregationValue = function (val) {
    $scope.$apply(function () {
      $scope.datasubmit.aggregation = val;
    });
  };

  $scope.ok = function () {
    var url = $scope.projectData.url;
    $scope.nameMsg = '';
    a2Soundscapes.create({
      n: $scope.datasubmit.name,
      p: $scope.datasubmit.playlist,
      a: $scope.datasubmit.aggregation,
      t: $scope.datasubmit.threshold,
      tr: $scope.datasubmit.thresholdReference,
      m: 22050,
      b: $scope.datasubmit.bin,
      f: $scope.datasubmit.bandwidth,
      nv: $scope.datasubmit.normalize
    }).success(function (data) {
      if (data.name) {
        $scope.nameMsg = 'Name exists';
      } else {
        $modalInstance.close(data);
      }
    }).error(function (data) {
      if (data.err) {
        $modalInstance.close({
          err: "Error: " + data.err
        });
      } else {
        $modalInstance.close({
          err: "Error: Cannot create soundscape job"
        });
      }
    });
  };

  $scope.buttonEnable = function () {
    return $scope.datasubmit.bin === 0 || typeof $scope.datasubmit.bin.length == 'string' || $scope.datasubmit.aggregation.length === 0 || typeof $scope.datasubmit.threshold.length == 'string' || typeof $scope.datasubmit.bandwidth.length == 'string' || $scope.datasubmit.name.length === 0 || typeof $scope.datasubmit.playlist == 'string';
  };

  $scope.cancel = function (url) {
    $modalInstance.close({
      url: url
    });
  };
}]).directive('a2Aggregationtypeselector', function () {
  return {
    restrict: 'E',
    scope: {
      "selected": "="
    },
    templateUrl: '/app/analysis/soundscapes/aggregationtypetelector.html',
    controller: ["$scope", function ($scope) {
      $scope.aggregations = [{
        name: 'Hour in Day',
        scale: ['00:00', '01:00', '......', '22:00', '23:00'],
        id: 'time_of_day'
      }, {
        name: 'Day in Week',
        scale: ['Sun', 'Mon', '......', 'Fri', 'Sat'],
        id: 'day_of_week'
      }, {
        name: 'Day in Month',
        scale: ['1', '2', '......', '30', '31'],
        id: 'day_of_month'
      }, {
        name: 'Month in Year',
        scale: ['Jan', 'Feb', '......', 'Nov', 'Dec'],
        id: 'month_in_year'
      }, {
        name: 'Day in Year',
        scale: ['1', '2', '......', '365', '366'],
        id: 'day_of_year'
      }, {
        name: 'Year',
        scale: ['2010', '2011', '......', '2016', '2017'],
        id: 'year'
      }];
      $scope.width = 200;
      $scope.padding = 18;
      $scope.height = 20;

      $scope.select = function (aggr) {
        $scope.selected = aggr.id;
      };
    }]
  };
}).directive('a2DrawAggregation', ["$window", function ($window) {
  var d3 = $window.d3;
  return {
    restrict: 'E',
    scope: {
      "aggregation": "="
    },
    link: function (scope, element, attrs) {
      // console.log(scope.aggregation);
      var draw = function (aggre) {
        var width = 200;
        var height = 20;
        var padding = 18;
        var svgContainer = d3.select(element[0]).append("svg").attr("width", width).attr("height", height);
        var axisScale = d3.scale.linear().domain([0, 4]).range([padding, width - padding]);
        var xAxis = d3.svg.axis().scale(axisScale).orient("bottom").ticks(5).tickValues([0, 1, 2, 3, 4]).tickFormat(function (d) {
          return aggre.scale[d];
        });
        var xAxisGroup = svgContainer.append("g").attr("transform", "translate(0,1)").attr("class", "aggregationaxis").call(xAxis);
      };

      scope.$watch('aggregation', function (value) {
        if (value) draw(value);
      });
    }
  };
}]).directive('a2ThresholdSelector', ["a2Soundscapes", function (a2Soundscapes) {
  return {
    restrict: 'E',
    scope: {
      "threshold": "=",
      "thresholdReference": "=",
      "bandwidth": "="
    },
    templateUrl: '/app/analysis/soundscapes/thresholdselector.html',
    link: function ($scope) {
      $scope.amplitudeReferences = [];
      var afterGetAmplitudeReferences = a2Soundscapes.getAmplitudeReferences().then(function (amplitudeReferences) {
        $scope.amplitudeReferences = amplitudeReferences;
      });

      $scope.setAmplitudeReference = function (amplitudeReference) {
        console.log("amplitudeReference", amplitudeReference);
        $scope.thresholdReference = amplitudeReference.value;
      };

      $scope.$watch('thresholdReference', function (thresholdReference) {
        afterGetAmplitudeReferences.then(function () {
          console.log("thresholdReference", thresholdReference, $scope.amplitudeReferences);
          $scope.amplitudeReference = $scope.amplitudeReferences.reduce(function (_, item) {
            return _ || (item.value == thresholdReference ? item : null);
          });
        });
      });
      $scope.$watch('threshold', function (n, o) {
        console.log('threshold', n, o);
        $scope.thresholdInvPercent = (1 - $scope.threshold) * 100;
      });
      $scope.$watch('thresholdInvPercent', function (n, o) {
        console.log('thresholdInvPercent', n, o);
        var precision = 0.1;
        $scope.threshold = Math.round((100 - $scope.thresholdInvPercent) / precision) / (100 / precision);
      });
    }
  };
}]).directive('a2DrawPeakThreshold', ["$window", function ($window) {
  var d3 = $window.d3;
  return {
    restrict: 'E',
    scope: {
      "threshold": "=",
      "bandwidth": "="
    },
    link: function ($scope, element, attrs) {
      var data = [0.7, 1.0, 0.1, 0.55, 0.1, 0.6, 0.9, 0.01, 0.15, 0.1, 0.4, 0.1];
      var data_scale = 0.5;
      var lineData = [];

      for (var i = 0; i < data.length; i++) {
        lineData.push({
          x: i + 1,
          y: data[i] * data_scale
        });
      }

      var peaks = [{
        x: 2.6,
        y: 1.0 * data_scale,
        d: 999999
      }, {
        x: 4.4,
        y: 0.55 * data_scale,
        d: 210
      }, {
        x: 7,
        y: 0.9 * data_scale,
        d: 520
      }, {
        x: 9,
        y: 0.15 * data_scale,
        d: 750
      }, {
        x: 11,
        y: 0.4 * data_scale,
        d: 950
      }];
      var WIDTH = 250,
          HEIGHT = 70,
          MARGINS = {
        top: 10,
        right: 10,
        bottom: 10,
        left: 24
      };
      var vis = d3.select(element[0]).append('svg').attr('width', WIDTH).attr('height', HEIGHT);
      var xRange = d3.scale.linear().range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(lineData, function (d) {
        return d.x;
      }), d3.max(lineData, function (d) {
        return d.x;
      })]);
      var yRange = d3.scale.linear().domain([0, 1]).range([HEIGHT - MARGINS.top, MARGINS.bottom]);
      var xAxis = d3.svg.axis().scale(xRange).ticks(0);
      var yAxis = d3.svg.axis().scale(yRange).ticks(3).tickSize(3).orient('left').tickSubdivide(true);

      var drawAmpThreshold = function (ampThresh) {
        yval = 50 * (1 - ampThresh) + 10;
        vis.selectAll("line.movingline").remove();
        $scope.line = vis.append('svg:line').attr("x1", MARGINS.left).attr("y1", yval).attr("x2", WIDTH - MARGINS.right).attr("y2", yval).attr('stroke', 'red').attr('stroke-width', 2).attr('fill', 'none').attr('class', 'movingline');
        vis.selectAll("text.peakText").remove();
        var peaki = 1;

        for (var i = 0; i < peaks.length; i++) {
          if (peaks[i].y >= ampThresh && peaks[i].d >= $scope.bandwidth) {
            $scope.peakText = vis.append("text").attr("x", WIDTH * (peaks[i].x / lineData.length)).attr("y", 50 * (1 - peaks[i].y) + 10).attr('font-size', '11px').style("text-anchor", "middle").attr('class', 'peakText').text("P" + peaki);
            peaki = peaki + 1;
          }
        }
      };

      $scope.$watch('threshold', function () {
        if (!$scope.threshold) return;
        drawAmpThreshold($scope.threshold);
      });
      $scope.$watch('bandwidth', function () {
        // $scope.banwidthPerc = ($scope.bandwidth)/100;
        // $scope.banwidthValue = Math.round(1000*$scope.banwidthPerc);
        $scope.banwidthValue = $scope.bandwidth;
        xval = Math.floor(WIDTH * (peaks[0].x / lineData.length)) - 11 + 190 * ($scope.bandwidth / 1000);
        vis.selectAll("line.movingline1").remove();
        $scope.line = vis.append('svg:line').attr("x1", xval).attr("y1", 12).attr("x2", xval).attr("y2", 60).attr('stroke', 'red').attr('stroke-width', 2).attr('fill', 'none').attr('class', 'movingline1');
        vis.selectAll("text.peakText").remove();
        var peaki = 1;

        for (var i = 0; i < peaks.length; i++) {
          if (peaks[i].y >= $scope.threshold && peaks[i].d > $scope.banwidthValue) {
            $scope.peakText = vis.append("text").attr("x", WIDTH * (peaks[i].x / lineData.length)).attr("y", 50 * (1 - peaks[i].y) + 10).attr('font-size', '11px').style("text-anchor", "middle").attr('class', 'peakText').text("P" + peaki);
            peaki = peaki + 1;
          }
        } // $scope.onBandwidth($scope.banwidthValue);
        // console.log($scope.banwidthValue);

      });
      vis.append('svg:g').attr('class', 'thresholdaxis').attr('transform', 'translate(0,' + (HEIGHT - MARGINS.bottom) + ')').call(xAxis);
      vis.append('svg:g').attr('class', 'thresholdaxis').attr('transform', 'translate(' + MARGINS.left + ',0)').call(yAxis);
      var lineFunc = d3.svg.line().x(function (d) {
        return xRange(d.x);
      }).y(function (d) {
        return yRange(d.y);
      }).interpolate('linear');
      vis.append('svg:path').attr('d', lineFunc(lineData)).attr('stroke', 'blue').attr('stroke-width', 2).attr('fill', 'none');
      $scope.line = vis.append('svg:line').attr("x1", Math.floor(WIDTH * (peaks[0].x / lineData.length)) - 11).attr("y1", 12).attr("x2", Math.floor(WIDTH * (peaks[0].x / lineData.length)) - 11).attr("y2", 60).attr('stroke', 'red').attr('stroke-width', 2).attr('fill', 'none');
      vis.append("text").attr("x", WIDTH / 2).attr("y", 68).attr('font-size', '9px').style("text-anchor", "middle").text("Hz");
    }
  };
}]).controller('SoundscapesDetailsCtrl', ["$scope", "soundscape", "playlist", "a2Soundscapes", "a2UserPermit", function ($scope, soundscape, playlist, a2Soundscapes, a2UserPermit) {
  $scope.showDownload = a2UserPermit.can('manage soundscapes');

  var data2xy = function (offset) {
    offset = offset || 0;
    return function (d, i) {
      return {
        x: i + offset,
        y: d
      };
    };
  };

  $scope.soundscape = soundscape;
  $scope.playlist = playlist;
  $scope.chartOptions = {
    lineColor: '#c42',
    width: 400,
    height: 400
  };
  a2Soundscapes.getAmplitudeReferences().then(function (amplitudeReferences) {
    this.amplitudeReferences = amplitudeReferences.reduce(function (_, _1) {
      _[_1.value] = _1;
      return _;
    }, {});
  }.bind(this));
  a2Soundscapes.findIndices(soundscape.id, function (result) {
    if (!result) return;
    $scope.index = {
      H: [],
      ACI: [],
      NP: []
    };
    $scope.indices = [];
    $scope.indices.push({
      time: "TIME",
      ACI: "ACI",
      NP: "NP"
    });

    for (var i = 0; i < result.H.length; i++) {
      var t = i + soundscape.min_t;
      $scope.indices.push({
        time: t,
        ACI: result.ACI[i],
        NP: result.NP[i]
      });
      $scope.index.H.push({
        x: t,
        y: result.H[i]
      });
      $scope.index.ACI.push({
        x: t,
        y: result.ACI[i]
      });
      $scope.index.NP.push({
        x: t,
        y: result.NP[i]
      });
    }
  });
}]);
angular.module('a2.audiodata.playlists.playlist-arithmetic', []).directive('playlistArithmetic', ["a2Playlists", function (a2Playlists) {
  return {
    restrict: 'E',
    templateUrl: '/app/audiodata/playlists/playlist-arithmetic.html',
    scope: {
      onExpressionSelected: '&'
    },
    controller: 'playlistArithmeticController as controller',
    requires: '^PlaylistCtrl',
    link: function (scope, element, attrs) {
      var controller = scope.controller;
      controller.initialize({
        onSelected: function (expression) {
          scope.onExpressionSelected({
            expression: expression
          });
        }
      });
      scope.$on('$destroy', function () {
        controller.$destroy();
      });
    }
  };
}]).controller('playlistArithmeticController', ["a2Playlists", "$interpolate", function (a2Playlists, $interpolate) {
  this.selected = {};
  this.operations = [{
    type: 'union',
    text: 'Join playlist 1 and 2',
    icon: 'a2-union',
    nameTemplate: '{{playlist1}} joined with {{playlist2}}'
  }, {
    type: 'intersection',
    text: 'Intersect playlist 1 and 2',
    icon: 'a2-intersect',
    nameTemplate: '{{playlist1}} intersected with {{playlist2}}'
  }, {
    type: 'subtraction',
    text: 'Remove playlist 2 from playlist 1',
    icon: 'a2-difference',
    nameTemplate: '{{playlist1}} minus {{playlist2}}'
  }];
  var removeOnInvalidateHandler;

  this.initialize = function (options) {
    this.options = options || {};
    removeOnInvalidateHandler = a2Playlists.$on('invalidate-list', function () {
      this.reset();
    }.bind(this));
    this.reset();
    this.updateNamePlaceholder();
  };

  this.reset = function () {
    return a2Playlists.getList().then(function (playlists) {
      this.playlists = playlists;
    }.bind(this));
  };

  this.$destroy = function () {
    removeOnInvalidateHandler();
  };

  this.updateNamePlaceholder = function () {
    var nameTemplate = (this.selected.operation || {}).nameTemplate || 'Playlist 3';
    var term1 = this.selected.term1 || {};
    var term2 = this.selected.term2 || {};
    this.namePlaceholder = $interpolate(nameTemplate)({
      playlist1: term1.name || '(playlist 1)',
      playlist2: term2.name || '(playlist 2)'
    });
  };

  this.submit = function () {
    var operation = this.selected.operation;
    var term1 = this.selected.term1;
    var term2 = this.selected.term2;
    var name = this.selected.name || this.namePlaceholder;

    if (operation && term1 && term2 && name) {
      if (this.options.onSelected) {
        this.options.onSelected({
          operation: operation.type,
          term1: term1.id,
          term2: term2.id,
          name: name
        });
      }
    }
  };
}]);
angular.module('a2.audiodata.playlists', ['a2.services', 'a2.directives', 'ui.bootstrap', 'a2.audiodata.playlists.playlist-arithmetic', 'humane']).config(["$stateProvider", function ($stateProvider) {
  $stateProvider.state('audiodata.playlists', {
    url: '/playlists',
    controller: 'PlaylistCtrl as controller',
    templateUrl: '/app/audiodata/playlists/playlists.html'
  });
}]).controller('PlaylistCtrl', ["$scope", "a2Playlists", "$modal", "notify", "a2UserPermit", "$location", function ($scope, a2Playlists, $modal, notify, a2UserPermit, $location) {
  this.initialize = function () {
    removeOnInvalidateHandler = a2Playlists.$on('invalidate-list', function () {
      this.reset();
    }.bind(this));
    this.reset();
  };

  this.reset = function () {
    $scope.loading = true;
    a2Playlists.getList({
      info: true
    }).then(function (data) {
      $scope.playlists = data;
      $scope.loading = false;
    });
  };

  this.operate = function (expression) {
    if (!a2UserPermit.can('manage playlists')) {
      notify.error('You do not have permission to combine playlists');
      return;
    }

    return a2Playlists.combine(expression).then(function () {
      notify.log('Playlist created');
    }).catch(function (err) {
      err = err || {};
      notify.error(err.message || err.data || 'Server error');
    });
  };

  this.edit = function () {
    if (!$scope.checked.length || $scope.checked.length > 1) {
      notify.log('Please select one playlist to edit');
      return;
    }

    if (!a2UserPermit.can('manage playlists')) {
      notify.error('You do not have permission to edit playlists');
      return;
    }

    $scope.pname = $scope.checked[0].name;
    const playlist_id = $scope.checked[0].id;
    const modalInstance = $modal.open({
      templateUrl: '/app/audiodata/edit-playlist.html',
      scope: $scope
    });
    modalInstance.result.then(function (playlistName) {
      a2Playlists.rename({
        id: playlist_id,
        name: playlistName
      }, function (data) {
        if (data.error) return console.log(data.error);
      });
    });
  };

  $scope.del = function () {
    if (!$scope.checked || !$scope.checked.length) return;

    if (!a2UserPermit.can('manage playlists')) {
      notify.error('You do not have permission to delete playlists');
      return;
    }

    const playlists = $scope.checked.map(function (row) {
      return '"' + row.name + '"';
    });
    const message = ["You are about to delete the following playlists: "];
    const message2 = ["Are you sure?"];
    $scope.popup = {
      messages: message.concat(playlists, message2),
      btnOk: "Yes",
      btnCancel: "No"
    };
    const modalInstance = $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      scope: $scope
    });
    modalInstance.result.then(function () {
      const playlistIds = $scope.checked.map(function (pl) {
        return pl.id;
      });
      $scope.loading = true;
      a2Playlists.remove(playlistIds, function (data) {
        if (data.error) return notify.error(data.error);
        a2Playlists.getList().then(function (data) {
          $scope.playlists = data;
          $scope.loading = false;
          notify.log((playlistIds.length > 1 ? 'Playlists ' : 'Playlist ') + 'deleted');
        });
      });
    });
  };

  $scope.create = function (url) {
    $location.path(url);
  };

  this.initialize();
}]);
angular.module('a2.audiodata.recordings.data-export-parameters', ['a2.directive.a2-auto-close-on-outside-click', 'a2.services', 'a2.directives', 'ui.bootstrap', 'humane', 'a2.directive.error-message']).directive('recordingDataExportParameters', ["$document", "$rootScope", function ($document, $rootScope) {
  return {
    restrict: 'E',
    templateUrl: '/app/audiodata/recordings/export-parameters.html',
    scope: {
      onExport: '&'
    },
    controller: 'recordingDataExportParametersController as controller',
    requires: '^RecsCtrl',
    link: function (scope, element, attrs, controller) {
      controller.initialize({
        onExport: function (parameters) {
          scope.onExport({
            parameters: parameters
          });
        }
      });
    }
  };
}]).service('recordingDataFieldTypes', function () {
  return [{
    title: 'Recording fields',
    identifier: 'recording',
    placeholder: 'filename, site, ...',
    list: [{
      value: 'filename',
      caption: 'Filename',
      tooltip: 'The recording filename'
    }, {
      value: 'site',
      caption: 'Site',
      tooltip: 'The recording site'
    }, {
      value: 'day',
      caption: 'Day',
      tooltip: 'The recording day'
    }, {
      value: 'hour',
      caption: 'Hour',
      tooltip: 'The recording hour'
    }, {
      value: 'url',
      caption: 'Url',
      tooltip: 'The recording URl'
    }],
    preselected: ['filename', 'site', 'day']
  }, {
    title: 'Validations by species/song type',
    identifier: 'validation',
    placeholder: 'Species - Sound...',
    getList: function (Project) {
      return Project.getClasses({
        validations: true
      }).then(function (classes) {
        return classes.map(function (cls) {
          return {
            value: cls.id,
            caption: cls.species_name + ' - ' + cls.songtype_name,
            badges: [{
              icon: 'val-1',
              value: cls.vals_present
            }, {
              icon: 'val-0',
              value: cls.vals_absent
            }]
          };
        });
      });
    }
  }, {
    title: 'Soundscape Composition',
    identifier: 'soundscapeComposition',
    placeholder: 'Wind, Birds, ...',
    getList: function (a2SoundscapeCompositionService) {
      return a2SoundscapeCompositionService.getClassList({
        isSystemClass: 1
      }).then(function (classes) {
        return classes.map(function (cls) {
          return {
            value: cls.id,
            caption: cls.name,
            group: cls.type
          };
        });
      });
    }
  }, {
    title: 'Tags',
    identifier: 'tag',
    placeholder: 'Tags...',
    getList: function (a2Tags) {
      return a2Tags.getForType('recording').then(function (tags) {
        return tags.map(function (tag) {
          return {
            value: tag.tag_id,
            caption: tag.tag,
            icon: 'fa-tag',
            badges: [{
              value: tag.count
            }]
          };
        });
      }.bind(this));
    }
  }, {
    title: 'Grouping of Detections',
    identifier: 'grouped',
    placeholder: 'Detections grouped by...',
    list: [{
      value: 'site',
      caption: 'Site',
      tooltip: 'Detections grouped by Site'
    }, {
      value: 'hour',
      caption: 'Hour',
      tooltip: 'Detections grouped by Hour'
    }, {
      value: 'date',
      caption: 'Date',
      tooltip: 'Detections grouped by Date'
    }]
  }, {
    title: 'Occupancy Model Format',
    identifier: 'species',
    placeholder: 'Select species...',
    getList: function (Project) {
      return Project.getClasses().then(function (classes) {
        // Exclude classes with repeating species names
        var cl = {};
        classes.forEach(function (cls) {
          const id = cls.species_name.split(' ').join('_');

          if (!cl[id]) {
            cl[id] = {
              value: cls.species,
              caption: cls.species_name,
              name: id
            };
          }
        });
        return Object.values(cl);
      });
    }
  }];
}).controller('recordingDataExportParametersController', ["$q", "$injector", "notify", "recordingDataFieldTypes", "a2UserPermit", function ($q, $injector, notify, recordingDataFieldTypes, a2UserPermit) {
  this.initialize = function (options) {
    options = options || {};

    if (options.onExport) {
      this.onExport = options.onExport;
    }

    this.parameter_set_list = recordingDataFieldTypes;
    this.selected = [];
    this.lists = this.parameter_set_list.map(function () {
      return [];
    });

    function getList(parameter_set) {
      return $q.resolve(parameter_set.getList ? $injector.invoke(parameter_set.getList) : parameter_set.list || []);
    }

    $q.all(this.parameter_set_list.map(getList)).then(function (allLists) {
      this.lists = allLists;

      if (this.isRfcx() && this.lists[1] && this.lists[1].length) {
        this.lists[1].splice(0, 0, {
          value: -1,
          caption: 'Select all species'
        });
      }

      if (this.isRfcx() && this.lists[5] && this.lists[5].length) {
        this.lists[5].splice(0, 0, {
          value: 0,
          caption: 'Select all species',
          name: 0
        });
      }

      this.selected = this.parameter_set_list.map(function (parameter_set, idx) {
        if (parameter_set.preselected) {
          var listByValue = allLists[idx].reduce(function (_, item) {
            _[item.value] = item;
            return _;
          }, {});
          return (parameter_set.preselected || []).map(function (value) {
            return listByValue[value];
          }).filter(function (_) {
            return !!_;
          });
        } else {
          return [];
        }
      });
    }.bind(this));
  };

  this.isSuper = a2UserPermit.isSuper();
  this.isRfcxUser = a2UserPermit.isRfcx();
  this.isRfcx = function () {
    return this.isRfcxUser || this.isSuper;
  }, this.checkSelectedValue = function (selected) {
    return selected && selected.find(function (row) {
      return row.value === -1;
    });
  };

  this.onSelected = function (selectedItem) {
    if (selectedItem && selectedItem.value === -1 && selectedItem.caption === 'Select all species') {
      this.selected[1] = [selectedItem];
    }

    if (selectedItem && selectedItem.value === 0 && selectedItem.caption === 'Select all species') {
      this.selected[5] = [selectedItem];
    }
  };

  this.resetFilters = function () {
    this.selected = [];
  };

  this.isDisabled = function () {
    return this.selected && this.selected[1] && this.selected[1].length && this.selected[1].length > 20;
  };

  this.isRecordingEmpty = function () {
    return this.selected && this.selected[0] && this.selected[0].length === 0;
  };

  this.exportData = function () {
    if (this.isRecordingEmpty()) {
      notify.log('At least 1 recording field is required');
      return;
    }

    var selected = this.selected;

    if (this.isRfcx() && selected[1] && selected[1].find(function (row) {
      return row.value === -1;
    })) {
      selected[1] = this.lists[1].filter(function (item) {
        if (item.value !== -1) {
          return item;
        }
      });
    }

    if (this.isRfcx() && selected[5] && selected[5].find(function (row) {
      return row.value === 0;
    })) {
      selected[5] = this.lists[5].filter(function (item) {
        if (item.value !== 0) {
          return item;
        }
      });
    }

    this.onExport(this.parameter_set_list.reduce(function (_, parameter_set, index) {
      if (selected[index] && selected[index].length && parameter_set.identifier !== 'species') {
        _[parameter_set.identifier] = selected[index].map(function (item) {
          return item.value;
        });
      }

      if (selected[index] && parameter_set.identifier === 'grouped' && selected[index].value) {
        _[parameter_set.identifier] = selected[index].value;
        _['grouped'] = selected[index].value;
      }

      if (selected[index] && parameter_set.identifier === 'species' && selected[index].length) {
        _[parameter_set.identifier] = selected[index].map(function (item) {
          return item.value;
        });
        _['species_name'] = selected[index].map(function (item) {
          return item.name;
        });
      }

      return _;
    }, {}));
  };

  this.onExport = function (parameters) {
    console.log("export parameters : ", parameters);
  };
}]);
angular.module('a2.audiodata.recordings.filter-parameters', ['a2.directive.a2-auto-close-on-outside-click', 'a2.services', 'a2.directives', 'ui.bootstrap', 'humane']).directive('recordingFilterParameters', ["$document", "$rootScope", function ($document, $rootScope) {
  return {
    restrict: 'E',
    templateUrl: '/app/audiodata/recordings/filter-parameters.html',
    scope: {
      isOpen: '=',
      maxDate: '=',
      minDate: '=',
      recTotal: '=',
      isLoading: '=',
      onApplyFilters: '&'
    },
    controller: 'recordingFilterParametersController as controller',
    requires: '^RecsCtrl',
    link: function (scope, element, attrs) {
      var controller = scope.controller;

      scope.applyFilters = function () {
        scope.onApplyFilters({
          filters: controller.getFilters()
        });
      };

      scope.resetFilters = function () {
        controller.params = {};
        scope.onApplyFilters({
          filters: controller.getFilters()
        });
      };

      controller.fetchOptions();
    }
  };
}]).controller('recordingFilterParametersController', ["$scope", "Project", "a2Classi", "a2SoundscapeCompositionService", "a2Playlists", "$q", "a2Tags", "$window", function ($scope, Project, a2Classi, a2SoundscapeCompositionService, a2Playlists, $q, a2Tags, $window) {
  var staticMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(function (mon, ind) {
    return {
      value: ind,
      string: mon,
      count: null
    };
  });
  var staticDays = [];

  for (var day = 1; day <= 31; day++) {
    staticDays.push({
      value: day,
      count: null
    });
  }

  var staticHours = [];

  for (var hour = 0; hour < 24; hour++) {
    staticHours.push({
      value: hour,
      string: (hour < 10 ? '0' : '') + hour + ':00',
      count: null
    });
  }

  function _1_get(attribute) {
    return function (_1) {
      return _1[attribute];
    };
  }

  function _1_mapper(mapFn) {
    return function (_1) {
      return _1.length !== undefined && _1.map(mapFn);
    };
  }

  var _1_get_value_mapper = _1_mapper(_1_get("value"));

  var _1_get_id_mapper = _1_mapper(_1_get("id"));

  var _1_get_tag_id_mapper = _1_mapper(_1_get("tag_id"));

  var _1_get_flags_mapper = _1_mapper(_1_get("flags"));

  var findObjectWith = function (arr, key, value) {
    var result = arr.filter(function (obj) {
      return obj[key] === value;
    });
    return result.length > 0 ? result[0] : null;
  };

  var classification_results = {
    model_only: [{
      caption: '<i class="fa a2-present"></i> Present',
      tooltip: 'Present',
      flags: {
        model: 1
      },
      equiv: {
        model_th: [1, 3]
      }
    }, {
      caption: '<i class="fa a2-absent"></i> Absent',
      tooltip: 'Absent',
      flags: {
        model: 0
      },
      equiv: {
        model_th: [0, 2]
      }
    }],
    model_th: [{
      caption: 'Model: <i class="fa a2-present"></i>, Th: <i class="fa a2-present"></i>',
      tooltip: 'Model: present, Theshold: present',
      flags: {
        model: 1,
        th: 1
      },
      equiv: {
        model_only: [1]
      }
    }, {
      caption: 'Model: <i class="fa a2-present"></i>, Th: <i class="fa a2-absent"></i>',
      tooltip: 'Model: present, Theshold: absent',
      flags: {
        model: 1,
        th: 0
      }
    }, {
      caption: 'Model: <i class="fa a2-absent"></i>, Th: <i class="fa a2-present"></i>',
      tooltip: 'Model: absent, Theshold: present',
      flags: {
        model: 0,
        th: 1
      }
    }, {
      caption: 'Model: <i class="fa a2-absent"></i>, Th: <i class="fa a2-absent"></i>',
      tooltip: 'Model: absent, Theshold: absent',
      flags: {
        model: 0,
        th: 0
      },
      equiv: {
        model_only: [0]
      }
    }]
  };
  this.options = {
    classes: [],
    presence: ['present', 'absent'],
    sites: [],
    sites_ids: [],
    playlists: [],
    years: [],
    months: [],
    days: [],
    hours: [],
    tags: [],
    classifications: [],
    classification_results: classification_results.model_only,
    soundscape_composition: [],
    soundscape_composition_annotation: ['present', 'absent']
  };
  this.params = {};
  this.loading = {
    sites: false
  };
  var filterDefs = [{
    name: "range",
    map: function set_range_bounds(range) {
      return range;
    }
  }, {
    name: "sites",
    map: _1_get_value_mapper
  }, {
    name: "sites_ids",
    map: _1_get_id_mapper
  }, {
    name: "hours",
    map: _1_get_value_mapper
  }, {
    name: "months",
    map: _1_get_value_mapper
  }, {
    name: "years",
    map: _1_get_value_mapper
  }, {
    name: "days",
    map: _1_get_value_mapper
  }, {
    name: "playlists",
    map: _1_get_id_mapper
  }, {
    name: "validations",
    map: _1_get_id_mapper
  }, {
    name: "tags",
    map: _1_get_tag_id_mapper
  }, {
    name: "presence"
  }, {
    name: "classifications",
    map: _1_get_id_mapper
  }, {
    name: "classification_results",
    map: _1_get_flags_mapper
  }, {
    name: "soundscape_composition",
    map: _1_get_id_mapper
  }, {
    name: "soundscape_composition_annotation"
  }];

  this.getFilters = function () {
    var filters = {};
    var params = this.params;
    filterDefs.forEach(function (filterDef) {
      var param = params[filterDef.name];
      var value = param && filterDef.map ? filterDef.map(param) : param;

      if (value instanceof Array ? value.length : value) {
        filters[filterDef.name] = value;
      }

      if (value && filterDef.name === 'sites') {
        const vals = filterDefs[2].map(param);
        filters['sites_ids'] = vals;
      }
    });
    return filters;
  };

  this.getRecordingsStatsPerSite = function (sites, filters, options) {
    var proms = sites.map(function (site) {
      return Project.getRecordingAvailability('!q:' + site.id + '---[1:31]');
    });
    return $q.all(proms).then(function (data) {
      return data.reduce(function (_, recAv) {
        return angular.merge(_, recAv);
      }, {});
    }).then(function (data) {
      // loading.sites = false
      var lists = {
        sites: [],
        // sitesList
        years: [],
        // yearsList
        months: [],
        // monthsList
        days: [],
        // daysList
        hours: [] // hoursList

      };
      var levelIds = Object.keys(lists);

      var getFilterOptions = function (filters, obj, level) {
        var count = 0;
        const currentLevel = levelIds[level];

        for (var child in obj) {
          if (Object.keys(filters).length && filters[currentLevel] && filters[currentLevel].indexOf(child) === -1) {
            // skip if filter is define and the value is not in it
            continue;
          }

          var item = findObjectWith(lists[currentLevel], 'value', child);

          if (!item) {
            const siteObj = currentLevel == 'sites' ? sites.find(function (site) {
              return site.name === child;
            }) : {};
            item = {
              value: child,
              count: 0
            };

            if (currentLevel == 'sites') {
              item.id = siteObj.id;
            }

            lists[currentLevel].push(item);
          }

          var itemCount;

          if (typeof obj[child] == 'number') {
            itemCount = obj[child];
          } else {
            if (level === 0) count = 0;
            itemCount = getFilterOptions(filters, obj[child], level + 1);
          }

          item.count += itemCount;
          count += itemCount;
        }

        return count;
      };

      getFilterOptions(filters, data, 0);
      options.sites = lists.sites;
      options.years = lists.years;
      options.months = lists.months.map(function (month) {
        month.value = parseInt(month.value);
        month.value--;
        return {
          value: month.value,
          string: $window.moment().month(month.value).format('MMM'),
          count: month.count
        };
      });
      options.days = lists.days.map(function (day) {
        day.value = parseInt(day.value);
        return day;
      });
      options.hours = lists.hours.map(function (hour) {
        hour.value = parseInt(hour.value);
        return {
          value: hour.value,
          string: $window.moment().hour(hour.value).minute(0).format('HH:mm'),
          count: hour.count
        };
      });

      var sort = function (a, b) {
        return a.value > b.value ? 1 : -1;
      };

      options.sites.sort(sort);
      options.years.sort(sort);
      options.months.sort(sort);
      options.days.sort(sort);
      options.hours.sort(sort);
    });
  };

  this.setRecStatsStatic = function (sites, bounds, options) {
    options.sites = sites.map(function (site) {
      return {
        value: site.name,
        count: null,
        id: site.id
      };
    });
    var years = [];
    var maxYear = (bounds.max ? new Date(bounds.max) : new Date()).getFullYear();
    var minYear = bounds.min ? new Date(bounds.min).getFullYear() : '1990';

    for (var year = maxYear; year >= minYear; year--) {
      years.push({
        value: year,
        count: null
      });
    }

    options.years = years;
    options.months = staticMonths;
    options.days = staticDays;
    options.hours = staticHours;
  };

  this.fetchOptions = function (filters) {
    var self = this;

    if (filters === undefined) {
      filters = {};
    }

    var options = this.options;
    var loading = this.loading;
    var sites;

    if ($scope.recTotal === undefined || $scope.minDate === undefined || $scope.maxDate === undefined) {
      // wait until all inputs are populated to make proper decision in a condition below
      setTimeout(function () {
        this.fetchOptions(filters);
      }.bind(this), 1000);
      return;
    }

    loading.sites = true;
    Project.getSites().then(function (data) {
      sites = data;

      if (sites.length < 50 && $scope.recTotal < 100000) {
        return self.getRecordingsStatsPerSite(sites, filters, options);
      } else {
        return self.setRecStatsStatic(sites, {
          min: $scope.minDate.toISOString(),
          max: $scope.maxDate.toISOString()
        }, options);
      }
    }).finally(function () {
      loading.sites = false;
    });
    Project.getClasses({
      validations: true
    }, function (classes) {
      options.classes = classes;
    });
    a2Playlists.getList().then(function (playlists) {
      options.playlists = playlists;
    });
    a2Tags.getForType('recording').then(function (tags) {
      var tagsObj = {};
      tags.forEach(function (t) {
        var key = t.tag;

        if (!tagsObj[key]) {
          tagsObj[key] = {
            tag: key,
            tag_id: [t.tag_id],
            count: t.count
          };
        } else {
          tagsObj[key].tag_id.push(t.tag_id);
          tagsObj[key].count++;
        }
      });
      options.tags = Object.values(tagsObj);
    }.bind(this));
    a2Classi.list(function (classifications) {
      options.classifications = classifications.map(function (c) {
        c.name = c.cname;
        c.id = c.job_id;
        delete c.cname;
        return c;
      });
    }.bind(this));
    a2SoundscapeCompositionService.getClassList({
      isSystemClass: 1
    }).then(function (classes) {
      options.soundscape_composition = classes;
    }.bind(this));
  };

  this.computeClassificationResultsOptions = function (classifications) {
    console.log("this.computeClassificationResults = function(classifications){", classifications);
    var haveThreshold = classifications && classifications.reduce(function (a, b) {
      return a || !!b.threshold;
    }, false);
    var old_crs = this.options.classification_results;
    var crs_key = haveThreshold ? 'model_th' : 'model_only';
    var new_crs = classification_results[crs_key];
    this.options.classification_results = new_crs;

    if (old_crs != new_crs) {
      this.params.classification_results = this.params.classification_results.reduce(function (r, cr) {
        var equiv = cr.equiv && cr.equiv[crs_key];

        if (equiv) {
          equiv.forEach(function (i) {
            var new_cr = new_crs[i];

            if (!r.index[new_cr]) {
              r.index[i] = 1;
              r.list.push(new_cr);
            }
          });
        }

        return r;
      }, {
        list: [],
        index: {}
      }).list;
    }
  };
}]);
angular.module('a2.audiodata.recordings', ['a2.directive.a2-auto-close-on-outside-click', 'a2.service.download-resource', 'a2.audiodata.recordings.data-export-parameters', 'a2.audiodata.recordings.filter-parameters', 'a2.services', 'a2.directives', 'ui.bootstrap', 'humane']).config(["$stateProvider", function ($stateProvider) {
  $stateProvider.state('audiodata.recordings', {
    url: '/recordings',
    controller: 'RecsCtrl as controller',
    templateUrl: '/app/audiodata/recordings/recordings.html'
  });
}]).controller('RecsCtrl', ["$scope", "Project", "a2Classi", "$http", "$modal", "notify", "a2UserPermit", "$downloadResource", function ($scope, Project, a2Classi, $http, $modal, notify, a2UserPermit, $downloadResource) {
  $scope.selectedRecId = [];
  $scope.checkedRec = [];

  this.getSearchParameters = function (output) {
    var params = angular.merge({}, $scope.params);
    output = output || ['list'];
    params.output = output;
    params.limit = $scope.limitPerPage;
    params.offset = output.indexOf('list') >= 0 ? ($scope.currentPage - 1) * $scope.limitPerPage : 0;
    params.sortBy = 'r.site_id DESC, r.datetime DESC';

    if (params.range) {
      params.range.from = moment(params.range.from).format('YYYY-MM-DD') + 'T00:00:00.000Z';
      params.range.to = moment(params.range.to).format('YYYY-MM-DD') + 'T23:59:59.999Z';
    }

    return params;
  };

  this.searchRecs = function (output) {
    $scope.loading = true;
    output = output || ['list'];
    var params = this.getSearchParameters(output);
    var expect = output.reduce(function (obj, a) {
      obj[a] = true;
      return obj;
    }, {});

    if (expect.list) {
      $scope.recs = [];
    }

    if (expect.count) {
      $scope.totalRecs = undefined;
    }

    Project.getRecs(params, function (data) {
      if (output.length == 1) {
        data = output.reduce(function (obj, a) {
          obj[a] = data;
          return obj;
        }, {});
      }

      if (expect.list) {
        $scope.recs = data.list; // Show selected recordings across pagination

        $scope.recs.forEach(function (rec) {
          if ($scope.selectedRecId.includes(rec.id)) {
            rec.checked = true;
          }
        });
        $scope.loading = false;
      }

      if (expect.count) {
        $scope.totalRecs = data.count;
      }

      if (expect.date_range && data.date_range.min_date && data.date_range.max_date) {
        $scope.minDate = new Date(new Date(data.date_range.min_date.substr(0, 10) + "T00:00:00.000Z").getTime() - 24 * 60 * 60 * 1000);
        $scope.maxDate = new Date(new Date(data.date_range.max_date.substr(0, 10) + "T23:59:59.999Z").getTime() + 24 * 60 * 60 * 1000);
      }
    });
  };

  this.sortRecs = function (sortKey, reverse) {
    $scope.sortKey = sortKey;
    $scope.reverse = reverse;
    this.searchRecs();
  };

  this.applyFilters = function (filters) {
    $scope.currentPage = 1;
    $scope.params = filters;
    this.searchRecs(['count', 'list']);
  };

  this.reloadList = function () {
    this.searchRecs(['count', 'list']);
  };

  this.exportPermit = function () {
    return a2UserPermit.can('manage project recordings');
  };

  this.createPlaylist = function () {
    var listParams = angular.merge({}, $scope.params);

    if (!Object.keys(listParams).length) {
      notify.log('Filter recordings and create a playlist');
      return;
    }

    if ($scope.totalRecs == 0) {
      notify.error('You can\'t create playlist with 0 recording');
      return;
    }

    if (!a2UserPermit.can('manage playlists')) {
      notify.error('You do not have permission to create playlists');
      return;
    }

    if (listParams.tags && listParams.tags.length) {
      listParams.tags = listParams.tags.flat();
    }

    if (listParams.presence && listParams.presence.length) {
      listParams.presence = listParams.presence[0];
    }

    if (listParams.range) {
      listParams.range.from = moment(listParams.range.from).format('YYYY-MM-DD') + 'T00:00:00.000Z';
      listParams.range.to = moment(listParams.range.to).format('YYYY-MM-DD') + 'T23:59:59.999Z';
    }

    if ($scope.selectedRecId && $scope.selectedRecId.length) {
      listParams.recIds = $scope.selectedRecId;
    }

    var modalInstance = $modal.open({
      controller: 'SavePlaylistModalInstanceCtrl',
      templateUrl: '/app/audiodata/create-playlist.html',
      resolve: {
        listParams: function () {
          return listParams;
        }
      },
      backdrop: false
    });
    modalInstance.result.then(function (data) {
      if (data.message === 'Playlist created') {
        notify.log(data.message);
      }
    });
  };

  this.isDisableDeleteRecs = function () {
    return !$scope.checkedRec.length && !$scope.checked;
  };

  this.deleteRecordings = function () {
    if (!a2UserPermit.can('manage project recordings')) {
      notify.error('You do not have permission to delete recordings');
      return;
    }

    const recs = $scope.checkedRec.filter(function (rec) {
      return !rec.imported;
    });

    if (!recs || !recs.length) {
      return notify.log('There are not any recordings to delete');
    }

    const recCount = recs.reduce(function (_, rec) {
      _[rec.site] = _[rec.site] + 1 || 1;
      return _;
    }, {});
    const messages = [],
          list = [];
    messages.push('Are you sure you want to delete the following?');
    Object.keys(recCount).forEach(function (site, index) {
      const s = recCount[site] > 1 ? 's' : '';

      if (index < 3) {
        list.push(recCount[site] + ' recording' + s + ' from "' + site + '"');
      }
    });

    if (Object.keys(recCount).length > 3) {
      var count = 0;
      Object.keys(recCount).forEach(function (site, index) {
        if (index >= 3) {
          count = count + recCount[site];
        }
      });
      const msg = '& ' + count + ' recordings from ' + (Object.keys(recCount).length - 3) + ' other sites';
      list.push(msg);
    }

    return $modal.open({
      templateUrl: '/common/templates/pop-up.html',
      controller: function () {
        this.messages = messages;
        this.list = list;
        this.note = 'Note: analysis results on these recordings will also be deleted';
        this.btnOk = "Delete";
        this.btnCancel = "Cancel";
      },
      controllerAs: 'popup'
    }).result.then(function () {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/recordings/delete', {
        recs: recs
      });
    }).then(function (response) {
      if (response.data.error) {
        return notify.error(response.data.error);
      }

      this.searchRecs(['count', 'list']);
      notify.log(response.data.msg);
    }.bind(this));
  };

  this.deleteAllRecordings = function () {
    var filters = $scope.params;

    if (!a2UserPermit.can('manage project recordings')) {
      notify.error('You do not have permission to delete recordings');
      return;
    }

    if (!$scope.recs.length) {
      notify.error('Recordings not found');
      return;
    }

    return Project.getRecCounts(filters).then(function (recCount) {
      var messages = [],
          importedCount = 0,
          importedSites = [],
          list = [];
      messages.push('Are you sure you want to delete the following?');
      recCount.forEach(function (entry, index) {
        var s = entry.count > 1 ? 's' : '';

        if (!entry.imported && index < 3) {
          list.push(entry.count + ' recording' + s + ' from "' + entry.site + '"');
        } else if (entry.imported) {
          importedCount += entry.count;
          importedSites.push('"' + entry.site + '"');
        }
      });

      if (recCount.length > 3) {
        var count = 0;
        recCount.forEach(function (entry, index) {
          if (index >= 3) {
            count = count + entry.count;
          }
        });
        const msg = '& ' + count + ' recordings from ' + (recCount.length - 3) + ' other sites';
        list.push(msg);
      }

      if (importedCount) {
        messages.push("(The filters matched " + importedCount + " recordings wich come from " + importedSites.join(", ") + ". You cannot delete these from your project, they can only be removed from their original project.)");
      }

      return $modal.open({
        templateUrl: '/common/templates/pop-up.html',
        controller: function () {
          this.messages = messages;
          this.list = list;
          this.note = 'Note: analysis results on these recordings will also be deleted';
          this.btnOk = "Delete";
          this.btnCancel = "Cancel";
        },
        controllerAs: 'popup'
      }).result;
    }).then(function () {
      return $http.post('/legacy-api/project/' + Project.getUrl() + '/recordings/delete-matching', filters).error(function (error) {
        return notify.error(error);
      });
    }).then(function (response) {
      if (response.data.error) {
        return notify.error(response.data.error);
      }

      this.searchRecs(['count', 'list']);
      notify.log(response.data.msg);
    }.bind(this));
  };

  $scope.params = {};
  $scope.loading = true;
  $scope.currentPage = 1;
  $scope.limitPerPage = 10;
  this.searchRecs(['count', 'date_range', 'list']);
  $scope.$watch('checked', function () {
    $scope.combineCheckedRecordings();
  });

  $scope.combineCheckedRecordings = function () {
    $scope.recs.forEach(function (rec) {
      if (rec.checked && !$scope.selectedRecId.includes(rec.id)) {
        $scope.selectedRecId.push(rec.id);
        $scope.checkedRec.push(rec);
      }
    });
  };

  $scope.selectRec = function (rec) {
    if (!rec.checked) {
      const index = $scope.selectedRecId.findIndex(function (id) {
        return id === rec.id;
      });
      $scope.selectedRecId.splice(index, 1);
      $scope.checkedRec.splice(index, 1);
      return;
    }

    if ($scope.selectedRecId.includes(rec.id)) return;
    $scope.selectedRecId.push(rec.id);
    $scope.checkedRec.push(rec);
  };

  this.setCurrentPage = function (currentPage) {
    $scope.currentPage = currentPage;
    this.searchRecs();
  };

  this.setLimitPerPage = function (limitPerPage) {
    $scope.limitPerPage = limitPerPage;
    this.searchRecs();
  };

  this.exportRecordings = function (listParams) {
    if (a2UserPermit.isSuper()) {
      return this.openExportPopup(listParams);
    }

    if (a2UserPermit.all && !a2UserPermit.all.length || !a2UserPermit.can('export report')) {
      return notify.error('You do not have permission to export data');
    }

    this.openExportPopup(listParams);
  };

  this.openExportPopup = function (listParams) {
    $scope.params.userEmail = a2UserPermit.getUserEmail() || '';
    const modalInstance = $modal.open({
      controller: 'ExportRecordingstModalInstanceCtrl',
      templateUrl: '/app/audiodata/export-report.html',
      resolve: {
        data: function () {
          return {
            params: $scope.params,
            listParams: listParams
          };
        }
      },
      backdrop: false
    });
    modalInstance.result.then(function () {
      notify.log('Your report export request is processing <br> and will be sent by email.');
    });
  };
}]).controller('SavePlaylistModalInstanceCtrl', ["$scope", "$modalInstance", "a2Playlists", "listParams", "notify", function ($scope, $modalInstance, a2Playlists, listParams, notify) {
  var result;

  $scope.savePlaylist = function (name) {
    $scope.isSavingPlaylist = true;
    a2Playlists.create({
      playlist_name: name,
      params: listParams
    }, function (data) {
      $scope.isSavingPlaylist = false;

      if (data.error) {
        $scope.errMess = data.error;
      } else {
        result = data;
        $modalInstance.close({
          message: 'Playlist created'
        });
      }
    });
    var timeout;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      $scope.isSavingPlaylist = false;
      $modalInstance.close({
        message: 'Playlist creating'
      });

      if (!$scope.errMess && !result) {
        notify.log('Your playlist is being created. <br> Check it in the project playlists');
      }
    }, 60000);
  };

  $scope.changePlaylistName = function () {
    $scope.errMess = null;
  };
}]).controller('ExportRecordingstModalInstanceCtrl', ["$scope", "$modalInstance", "Project", "data", function ($scope, $modalInstance, Project, data) {
  $scope.userEmail = data.params.userEmail;

  $scope.exportRecordings = function (email) {
    data.params.userEmail = email;
    $scope.isExportingRecs = true;
    $scope.errMess = '';
    Project.getRecordingData(data.params, data.listParams).then(function (data) {
      $scope.isExportingRecs = false;

      if (data.error) {
        $scope.errMess = data.error;
      } else {
        $modalInstance.close();
      }
    });
  };

  $scope.changeUserEmail = function () {
    $scope.errMess = null;
  };
}]).directive("customSrc", function () {
  return {
    link: function (scope, element, attrs) {
      var img, loadImage;
      img = null;

      loadImage = function () {
        element[0].src = '';
        img = new Image();
        img.src = attrs.customSrc;

        img.onload = function () {
          element[0].src = attrs.customSrc;
        };

        img.onerror = function () {
          element[0].src = 'https://rfcx-web-static.s3.eu-west-1.amazonaws.com/arbimon/unavaliable.png';
        };
      };

      scope.$watch(function () {
        return attrs.customSrc;
      }, function (newVal, oldVal) {
        if (oldVal !== newVal) {
          loadImage();
        }
      });
    }
  };
});
angular.module('a2.audiodata.templates', ['a2.services', 'a2.directives', 'ui.bootstrap', 'a2.srv.templates', 'a2.directive.audio-bar', 'a2.visualizer.audio-player', 'humane']).config(["$stateProvider", function ($stateProvider) {
  $stateProvider.state('audiodata.templates', {
    url: '/templates',
    controller: 'TemplatesCtrl as controller',
    templateUrl: '/app/audiodata/templates/templates.html'
  });
}]).controller('TemplatesCtrl', ["$scope", "a2Templates", "Project", "SpeciesTaxons", "$localStorage", "a2UserPermit", "notify", "$modal", "$window", "a2AudioBarService", function ($scope, a2Templates, Project, SpeciesTaxons, $localStorage, a2UserPermit, notify, $modal, $window, a2AudioBarService) {
  var self = this;
  Object.assign(this, {
    initialize: function () {
      this.loading = false;
      this.isAdding = false;
      this.templates = [];
      this.currentTab = 'projectTemplates';
      this.pagination = {
        page: 1,
        limit: 100,
        offset: 0,
        totalItems: 0,
        totalPages: 0
      };
      this.projecturl = Project.getUrl();
      this.search = {
        q: '',
        taxon: ''
      };
      this.getTaxons();
      this.getList();
      this.timeout;
      this.taxons = [{
        id: 0,
        taxon: 'All taxons'
      }];
      this.search.taxon = this.taxons[0];
    },
    goToSourceProject: function (projectId) {
      if (!projectId) return;
      Project.getProjectById(projectId, function (data) {
        if (data) {
          $window.location.pathname = "/project/" + data.url + "/audiodata/templates";
        }
      });
    },
    setCurrentPage: function () {
      self.pagination.offset = self.pagination.page - 1;
      this.getList();
    },
    getTaxons: function () {
      SpeciesTaxons.getList(function (data) {
        if (data && data.length) {
          data.forEach(function (taxon) {
            self.taxons.push(taxon);
          });
        }
      });
    },
    getList: function () {
      self.loading = true;
      const opts = {
        showRecordingUri: true,
        q: self.search.q,
        taxon: self.search.taxon && self.search.taxon.id ? self.search.taxon.id : null,
        limit: self.pagination.limit,
        offset: self.pagination.offset * self.pagination.limit
      };
      opts[self.currentTab] = true;
      return a2Templates.getList(opts).then(function (data) {
        self.loading = false;
        self.templates = data.list;
        self.pagination.totalItems = data.count;
        self.pagination.totalPages = Math.ceil(self.pagination.totalItems / self.pagination.limit);
      }.bind(this)).catch(function (err) {
        self.loading = false;
        self.templates = [];
        notify.serverError(err);
      }.bind(this));
    },
    onSearchChanged: function () {
      var _this = this;

      self.loading = true;
      clearTimeout(self.timeout);
      self.timeout = setTimeout(function () {
        if (self.search.q.trim().length > 0 && self.search.q.trim().length < 3) return;

        _this.reloadPage();
      }, 1000);
    },
    reloadPage: function () {
      this.resetPagination();
      this.getList();
    },
    getTemplateVisualizerUrl: function (template) {
      const box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
      return template ? "/project/" + template.project_url + "/#/visualizer/rec/" + template.recording + "?a=" + box : '';
    },
    deleteTemplate: function (templateId) {
      if (!a2UserPermit.can('manage templates')) {
        notify.error('You do not have permission to delete templates');
        return;
      }

      $scope.popup = {
        title: 'Delete template',
        messages: ['Are you sure you want to delete this template?'],
        btnOk: 'Yes',
        btnCancel: 'No'
      };
      var modalInstance = $modal.open({
        templateUrl: '/common/templates/pop-up.html',
        scope: $scope
      });
      modalInstance.result.then(function (confirmed) {
        if (confirmed) {
          return a2Templates.delete(templateId).then(function () {
            self.getList();
          });
        }
      });
    },
    toggleTab: function (access) {
      self.currentTab = access;
      this.reloadPage();
    },
    resetPagination: function () {
      self.pagination = {
        page: 1,
        limit: 100,
        offset: 0,
        totalItems: 0,
        totalPages: 0
      };
    },
    addTemplate: function (template) {
      self.isAdding = true;
      a2Templates.add({
        name: template.name,
        recording: template.recording,
        species: template.species,
        songtype: template.songtype,
        roi: {
          x1: template.x1,
          y1: template.y1,
          x2: template.x2,
          y2: template.y2
        },
        source_project_id: template.project
      }).then(function (template) {
        console.log('new template', template);
        self.isAdding = false;
        if (template.id === 0) notify.error('The template already exists in the project templates.');else if (template.error) notify.error('You do not have permission to manage templates');else notify.log('The template is added to the project.');
      }).catch(function (err) {
        console.log('err', err);
        self.isAdding = false;
        notify.error(err);
      });
    },
    playTemplateAudio: function (template, $event) {
      if ($event) {
        $event.preventDefault();
        $event.stopPropagation();
      }

      ;
      $localStorage.setItem('a2-audio-param-gain', JSON.stringify(2));
      console.info('play');
      a2AudioBarService.loadUrl(a2Templates.getAudioUrlFor(template), true);
    }
  });
  this.initialize();
}]);
angular.module('a2.audiodata.uploads', ['ui.router', 'a2.audiodata.uploads.upload', 'a2.audiodata.uploads.processing']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('audiodata.uploads', {
    url: '/uploads',
    template: '<ui-view />',
    abstract: true
  });
}]);
angular.module('a2.audiodata.uploads.processing', ['a2.services', 'a2.srv.uploads', 'a2.directives', 'ui.bootstrap', 'angularFileUpload', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('audiodata.uploads.processing', {
    url: '/processing',
    controller: 'A2AudioDataUploadsProcessingCtrl as controller',
    templateUrl: '/app/audiodata/uploads/processing.html'
  });
}]).controller('A2AudioDataUploadsProcessingCtrl', ["$scope", "a2UploadsService", function ($scope, a2UploadsService) {
  this.loadPage = function () {
    this.loading = true;
    a2UploadsService.getProcessingList().then(function (data) {
      this.loading = false;
      this.list = data.list;
      this.count = data.count;
    }.bind(this));
  };

  this.loadPage();
}]);
angular.module('a2.audiodata.uploads.upload', ['a2.services', 'a2.directives', 'ui.bootstrap', 'angularFileUpload', 'a2.srv.app-listings', 'a2.filter.caps', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('audiodata.uploads.upload', {
    url: '/',
    controller: 'A2AudioDataUploadsUploadCtrl as controller',
    templateUrl: '/app/audiodata/uploads/upload.html'
  });
}]).filter('prettyBytes', function () {
  return function (bytes) {
    var labels = ['B', 'kB', 'MB', 'GB'];
    var newBytes;
    var p;

    for (p = 1; bytes / Math.pow(1024, p) > 1; p++) {
      newBytes = bytes / Math.pow(1024, p);
    }

    newBytes = Math.round(newBytes * 100) / 100;
    return String(newBytes) + ' ' + labels[p - 1];
  };
}).controller('A2AudioDataUploadsUploadCtrl', ["$scope", "uploads", "Project", "AppListingsService", "a2UserPermit", "notify", "$interval", "a2UploadsService", function ($scope, uploads, Project, AppListingsService, a2UserPermit, notify, $interval, a2UploadsService) {
  $scope.verifyAndUpload = function () {
    if (!a2UserPermit.can('manage project recordings')) {
      notify.error("You do not have permission to upload recordings");
      return;
    }

    var index = 0;
    $scope.uploading = true;

    var _verifyAndUpload = function () {
      var item = $scope.uploader.queue[index];

      if (item && item.file && !item.file.size) {
        item.isError = true;
        item.errorMsg = "Error of the file size";
        return;
      }

      var next = function () {
        index++;

        _verifyAndUpload();
      };

      if (!item || !$scope.uploading) {
        $scope.uploading = false;
        return;
      }

      if (item.isSuccess) // file uploaded on current batch
        return next();
      Project.recExists($scope.info.site.id, item.file.name, function (exists) {
        if (exists) {
          console.log('duplicated');
          item.isDuplicate = true;
          return next();
        }

        item.url = '/uploads/audio?project=' + $scope.project.project_id + '&site=' + $scope.info.site.id + '&nameformat=' + $scope.info.format.name + '&timezone=' + $scope.info.timezone.format;
        item.upload();
        item.onSuccess = next;
        item.onError = next;
      });
    };

    _verifyAndUpload();
  };

  $scope.isCheckingStatus = false;

  $scope.queueJobToCheckStatus = function () {
    if ($scope.isCheckingStatus) return;
    $scope.isCheckingStatus = true;
    a2UploadsService.getProcessingList({
      site: $scope.info.site.id
    }).then(function (files) {
      const uploadingFiles = $scope.getUploadingFiles();

      if (!uploadingFiles.length) {
        $scope.cancelTimer();
        $scope.isCheckingStatus = false;
        return;
      }

      const userFiles = uploadingFiles.map(function (fileObj) {
        return fileObj.file.name;
      });

      if (files && files.length) {
        const filesToCheck = files.filter(function (file) {
          return userFiles.includes(file.name);
        });
        const items = filesToCheck.slice(0, 5).map(function (item) {
          return {
            uploadUrl: item.uploadUrl,
            uploadId: item.id,
            filename: item.name
          };
        });
        a2UploadsService.checkStatus({
          items: items
        }).then(function (data) {
          if (data) {
            data.forEach(function (item) {
              const userFile = uploadingFiles.find(function (fileObj) {
                return fileObj.file.name === item.filename;
              });

              if (userFile && item.status === 'uploaded') {
                $scope.makeSuccessItem(userFile);
              }
            });
            $scope.isCheckingStatus = false;
          }
        });
      }
    });
  };

  $scope.getUploadingFiles = function () {
    const uploadingFiles = $scope.uploader.queue.filter(function (file) {
      return file.isSuccess === true && file.isUploaded === false;
    });
    return uploadingFiles && uploadingFiles.length ? uploadingFiles : [];
  };

  $scope.checkUploadingFiles = function () {
    if ($scope.getUploadingFiles().length) {
      $scope.startTimer();
    }
  };

  $scope.startTimer = function () {
    $scope.cancelTimer();
    $scope.checkStatusInterval = $interval(function () {
      $scope.queueJobToCheckStatus();
    }, 10000);
  };

  $scope.cancelTimer = function () {
    if ($scope.checkStatusInterval) {
      $interval.cancel($scope.checkStatusInterval);
    }
  };

  $scope.$on('$destroy', function () {
    $scope.cancelTimer();
  });
  AppListingsService.getFor('arbimon2-desktop-uploader').then(function (uploaderAppListing) {
    this.uploaderAppListing = uploaderAppListing;
  }.bind(this));

  $scope.stopQueue = function () {
    $scope.uploading = false;
    angular.forEach($scope.uploader.queue, function (item) {
      item.cancel();
    });
  };

  $scope.uploader = uploads.getUploader();
  $scope.info = {};
  $scope.formats = [{
    name: "Arbimon",
    format: "(*-YYYY-MM-DD_HH-MM)"
  }, {
    name: "AudioMoth",
    format: "(*YYYYMMDD_HHMMSS)"
  }, {
    name: "AudioMoth legacy",
    format: "(Unix Time code in Hex)"
  }, {
    name: "Cornell",
    format: "(*_YYYYMMDD_HHMMSSZ)"
  }, {
    name: "Song Meter",
    format: "(*_YYYYMMDD_HHMMSS)"
  }, {
    name: "Wildlife",
    format: "(YYYYMMDD_HHMMSS)"
  }];
  $scope.fileTimezone = [{
    name: "UTC",
    format: "utc"
  }, {
    name: "Site timezone",
    format: "local"
  }];
  Project.getSites({
    utcDiff: true
  }, function (sites) {
    $scope.sites = sites.sort(function (a, b) {
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  });

  $scope.selectSite = function () {
    const local = $scope.info && $scope.info.site && $scope.info.site.utcOffset ? $scope.info.site.utcOffset + ' (local)' : 'Site timezone';
    $scope.fileTimezone[1].name = local;
    $scope.info.timezone = $scope.fileTimezone[1];
  };

  $scope.isStartUploadDisabled = function () {
    return !$scope.uploader.queue.length || $scope.isLimitExceeded() || !$scope.info.site || !$scope.info.format || $scope.uploading;
  };

  $scope.isLimitExceeded = function () {
    return $scope.uploader.queue.length > 1000;
  };

  const randomString = Math.round(Math.random() * 100000000);
  this.uploaderApps = {
    mac: 'https://rf.cx/ingest-app-latest-mac?r=' + randomString,
    windows: 'https://rf.cx/ingest-app-latest-win?r=' + randomString
  };
  Project.getInfo(function (info) {
    $scope.project = info;
  });
  $scope.uploader.filters.push({
    name: 'supportedFormats',
    fn: function (item) {
      var name = item.name.split('.');
      var extension = name[name.length - 1].toLowerCase();
      var validFormats = /mp3|flac|wav|opus/i;
      if (!validFormats.exec(extension)) return false;
      return true;
    }
  });
  $scope.uploader.filters.push({
    name: 'notDuplicate',
    fn: function (item) {
      var duplicate = $scope.uploader.queue.filter(function (qItem) {
        return qItem.file.name === item.name;
      });
      return !duplicate.length;
    }
  });

  $scope.uploader.onErrorItem = function (item, response, status, headers) {
    if (response.error) {
      item.errorMsg = response.error;
    } else if (status >= 500) {
      item.errorMsg = "Server error";
      return;
    } else {
      item.errorMsg = "An error ocurred";
    }
  };

  $scope.uploader.onSuccessItem = function (item, response, status, headers) {
    item.isUploaded = false;
    console.info('count of uploading files', $scope.getUploadingFiles().length);
    $scope.checkUploadingFiles();
  };

  $scope.makeSuccessItem = function (item) {
    item.status = 'uploaded';
    item.isUploading = false;
    item.isSuccess = false;
    item.isUploaded = true;
    item.progress = 100;
  };

  $scope.getProgress = function (item) {
    if (item.isUploading && item.progress === 100) return 90;else if (item.isSuccess && !item.isUploaded) return 90;else return item.progress;
  };

  $scope.removeCompleted = function () {
    if (!$scope.uploader.queue.length) return;
    $scope.uploader.queue = $scope.uploader.queue.filter(function (file) {
      return !file.isSuccess;
    });
  };

  $scope.getCountOfUploaded = function () {
    if (!$scope.uploader || !$scope.uploader.queue || !$scope.uploader.queue.length) return 0;
    $scope.uploaded = $scope.uploader.queue.filter(function (file) {
      return !!file.isUploaded && !file.isError;
    }).length;
    return $scope.uploaded;
  };

  $scope.clearQueue = function () {
    $scope.uploader.progress = 0;
    $scope.uploaded = 0;
  };

  $scope.uploaded = 0;

  $scope.uploader.onProgressAll = function () {};
}]).factory('uploads', ["FileUploader", function (FileUploader) {
  var u = new FileUploader();
  window.addEventListener("beforeunload", function (e) {
    if (u.isUploading) {
      var confirmationMessage = "Upload is in progress, Are you sure to exit?";
      (e || window.event).returnValue = confirmationMessage; //Gecko + IE

      return confirmationMessage; //Webkit, Safari, Chrome etc.
    }
  });
  return {
    getUploader: function () {
      return u;
    }
  };
}]);
angular.module('a2.citizen-scientist.admin', ['ui.router', 'a2.citizen-scientist.admin.classification-stats', 'a2.citizen-scientist.admin.user-stats', 'a2.citizen-scientist.admin.settings']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('citizen-scientist.admin', {
    url: '/admin',
    template: '<ui-view />',
    abstract: true
  });
}]);
angular.module('a2.citizen-scientist.expert', ['ui.bootstrap', 'a2.srv.patternmatching', 'a2.srv.citizen-scientist', 'a2.srv.citizen-scientist-expert', 'a2.visualizer.audio-player', 'a2.services', 'a2.permissions', 'humane', 'c3-charts']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('citizen-scientist.expert', {
    url: '/expert/:patternMatchingId?',
    controller: 'CitizenScientistExpertCtrl',
    templateUrl: '/app/citizen-scientist/expert/list.html'
  });
}]).controller('CitizenScientistExpertCtrl', ["$scope", "$filter", "Project", "ngTableParams", "a2Playlists", "notify", "$q", "a2CitizenScientistService", "a2CitizenScientistExpertService", "a2PatternMatching", "a2UserPermit", "$state", "$stateParams", function ($scope, $filter, Project, ngTableParams, a2Playlists, notify, $q, a2CitizenScientistService, a2CitizenScientistExpertService, a2PatternMatching, a2UserPermit, $state, $stateParams) {
  $scope.selectedPatternMatchingId = $stateParams.patternMatchingId;

  var initTable = function (p, c, s, f, t) {
    var sortBy = {};
    var acsDesc = 'desc';

    if (s[0] == '+') {
      acsDesc = 'asc';
    }

    sortBy[s.substring(1)] = acsDesc;
    var tableConfig = {
      page: p,
      count: c,
      sorting: sortBy,
      filter: f
    };
    $scope.tableParams = new ngTableParams(tableConfig, {
      total: t,
      getData: function ($defer, params) {
        $scope.infopanedata = "";
        var filteredData = params.filter() ? $filter('filter')($scope.patternmatchingsOriginal, params.filter()) : $scope.patternmatchingsOriginal;
        var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.patternmatchingsOriginal;
        params.total(orderedData.length);
        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

        if (orderedData.length < 1) {
          $scope.infopanedata = "No Pattern matchings searches found.";
        }

        $scope.patternmatchingsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
      }
    });
  };

  $scope.getTemplateVisualizerUrl = function (template) {
    var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
    return template ? "/project/" + template.source_project_uri + "/visualizer/rec/" + template.recording + "?a=" + box : '';
  }, $scope.selectItem = function (patternmatchingId) {
    $state.go('citizen-scientist.expert', {
      patternMatchingId: patternmatchingId ? patternmatchingId : undefined
    });
  };

  $scope.loadPatternMatchings = function () {
    $scope.loading = true;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    return a2CitizenScientistExpertService.getPatternMatchings().then(function (data) {
      $scope.patternmatchingsOriginal = data;
      $scope.patternmatchingsData = data;
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
      $scope.infopanedata = "";

      if (data.length > 0) {
        if (!$scope.tableParams) {
          initTable(1, 10, "+cname", {}, data.length);
        } else {
          $scope.tableParams.reload();
        }
      } else {
        $scope.infopanedata = "No pattern matchings found.";
      }
    });
  };

  if (!$scope.selectedPatternMatchingId) {
    $scope.loadPatternMatchings();
  }
}]).directive('a2CitizenScientistExpertDetails', function () {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      patternMatchingId: '=',
      onGoBack: '&'
    },
    controller: 'CitizenScientistExpertDetailsCtrl',
    controllerAs: 'controller',
    templateUrl: '/app/citizen-scientist/expert/details.html'
  };
}).filter('pmValidation', function () {
  return function (validation, cp, cnp) {
    if (validation == 1) {
      return 'present';
    } else if (validation == 0) {
      return 'not present';
    } else if (validation === null || validation === undefined) {
      if (cp > 0 && cnp > 0) {
        return 'conflicted';
      } else {
        return '---';
      }
    }
  };
}).controller('CitizenScientistExpertDetailsCtrl', ["$scope", "a2PatternMatching", "a2Templates", "a2CitizenScientistExpertService", "a2UserPermit", "Project", "a2AudioBarService", "notify", function ($scope, a2PatternMatching, a2Templates, a2CitizenScientistExpertService, a2UserPermit, Project, a2AudioBarService, notify) {
  Object.assign(this, {
    id: null,
    initialize: function (patternMatchingId) {
      this.id = patternMatchingId;
      this.offset = 0;
      this.limit = 100;
      this.selected = {
        roi_index: 0,
        roi: null,
        page: 0
      };
      this.total = {
        rois: 0,
        pages: 0
      };
      this.loading = {
        details: false,
        rois: false
      };
      this.validation = this.lists.validation[2];
      this.thumbnailClass = this.lists.thumbnails[0].value;
      this.expertSearch = this.lists.search[0];
      this.projecturl = Project.getUrl();
      this.fetchDetails().then(function () {
        this.loadPage(this.selected.page);
      }.bind(this));
    },
    compositeValidation: function (roi) {
      var expert_val = roi.expert_validated;
      var consensus_val = roi.consensus_validated;
      var cp = roi.cs_val_present;
      var cnp = roi.cs_val_not_present;
      return [expert_val, consensus_val, cp > 0 && cnp > 0 ? -1 : null].reduce(function (_, arg) {
        return _ === null ? arg : _;
      }, null);
    },
    lists: {
      thumbnails: [{
        class: 'fa fa-th-large',
        value: ''
      }, {
        class: 'fa fa-th',
        value: 'is-small'
      }],
      search: [{
        value: 'all',
        text: 'All',
        description: 'Show all matched rois.'
      }, {
        value: 'consensus',
        text: 'Consensus',
        description: 'Show only rois where there is a consensus.'
      }, {
        value: 'pending',
        text: 'Pending',
        description: 'Show only rois that have not reached a consensus yet.'
      }, {
        value: 'conflicted',
        text: 'Conflicted',
        description: 'Show only rois where there is a conflict.'
      }, {
        value: 'expert',
        text: 'Expert',
        description: 'Show only rois that have been decided by an expert.'
      }],
      selection: [{
        value: 'all',
        text: 'All'
      }, {
        value: 'none',
        text: 'None'
      }, {
        value: 'not-validated',
        text: 'Not Validated'
      }],
      validation: [{
        class: "fa val-1",
        text: "Present",
        value: 1
      }, {
        class: "fa val-0",
        text: "Not Present",
        value: 0
      }, {
        class: "fa val-null",
        text: "Clear",
        value: null
      }]
    },
    fetchDetails: function () {
      this.loading.details = true;
      return a2CitizenScientistExpertService.getPatternMatchingDetailsFor(this.id).then(function (patternMatching) {
        this.loading.details = false;
        this.patternMatching = patternMatching;
        this.setupExportUrl();
        this.total = {
          rois: patternMatching.matches,
          pages: Math.ceil(patternMatching.matches / this.limit)
        };
      }.bind(this)).catch(function (err) {
        this.loading.details = false;
        return notify.serverError(err);
      }.bind(this));
    },
    onExpertSearchChanged: function () {
      this.selected.page = 0;
      this.loadPage(0);
    },
    setupExportUrl: function () {
      this.patternMatchingExportUrl = a2CitizenScientistExpertService.getCSExportUrl({
        patternMatching: this.patternMatching.id
      });
    },
    onScroll: function ($event, $controller) {
      this.scrollElement = $controller.scrollElement;
      var scrollPos = $controller.scrollElement.scrollY;
      var headerTop = $controller.anchors.header.offset().top;
      this.headerTop = headerTop | 0;
      this.scrolledPastHeader = scrollPos >= headerTop;
    },
    onSelect: function ($item) {
      this.select($item.value);
    },
    loadPage: function (pageNumber) {
      this.loading.rois = true;
      return a2CitizenScientistExpertService.getPatternMatchingRoisFor(this.id, this.limit, pageNumber * this.limit, {
        search: this.expertSearch && this.expertSearch.value
      }).then(function (rois) {
        this.loading.rois = false;
        this.rois = rois.reduce(function (_, roi) {
          var sitename = roi.site;
          var recname = roi.recording;

          if (!_.idx[sitename]) {
            _.idx[sitename] = {
              list: [],
              idx: {},
              name: sitename
            };

            _.list.push(_.idx[sitename]);
          }

          var site = _.idx[sitename];
          site.list.push(roi);
          return _;
        }, {
          list: [],
          idx: {}
        }).list;
        this.selected.roi = Math.min();

        if (this.scrollElement) {
          this.scrollElement.scrollTo(0, 0);
        }

        return rois;
      }.bind(this)).catch(function (err) {
        this.loading.rois = false;
        return notify.serverError(err);
      }.bind(this));
    },
    playRoiAudio: function (roi, $event) {
      if ($event) {
        $event.preventDefault();
        $event.stopPropagation();
      }

      a2AudioBarService.loadUrl(a2PatternMatching.getAudioUrlFor(roi), true);
    },
    playTemplateAudio: function () {
      a2AudioBarService.loadUrl(a2Templates.getAudioUrlFor(this.patternMatching.template), true);
    },
    getRoiVisualizerUrl: function (roi) {
      var box = ['box', roi.x1, roi.y1, roi.x2, roi.y2].join(',');
      return roi ? "/project/" + this.projecturl + "/visualizer/rec/" + roi.recording_id + "?a=" + box : '';
    },
    getTemplateVisualizerUrl: function (template) {
      var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
      return template ? "/project/" + template.source_project_uri + "/visualizer/rec/" + template.recording + "?a=" + box : '';
    },
    setRoi: function (roi_index) {
      if (this.total.rois <= 0) {
        this.selected.roi_index = 0;
        this.selected.roi = null;
      } else {
        this.selected.roi_index = Math.max(0, Math.min(roi_index | 0, this.total.rois - 1));
        this.selected.roi = this.rois[this.selected.roi_index];
      }

      return this.selected.roi;
    },
    setPage: function (page, force) {
      if (this.total.rois <= 0) {
        this.selected.page = 0;
        this.rois = [];
        return this.rois;
      } else {
        page = Math.max(0, Math.min(page, this.total.rois / this.limit | 0));

        if (page != this.selected.page || force) {
          this.selected.page = page;
          return this.loadPage(page);
        }
      }
    },
    select: function (option) {
      var selectFn = null;

      if (option === "all") {
        selectFn = function (roi) {
          roi.selected = true;
        };
      } else if (option === "none") {
        selectFn = function (roi) {
          roi.selected = false;
        };
      } else if (option === "not-validated") {
        selectFn = function (roi) {
          roi.selected = roi.cs_validated === null;
        };
      } else {
        selectFn = function (roi) {
          roi.selected = roi.id === option;
        };
      }

      this.forEachRoi(selectFn);
    },
    forEachRoi: function (fn) {
      (this.rois || []).forEach(function (site) {
        site.list.forEach(fn);
      });
    },
    validate: function (validation, rois) {
      if (!a2UserPermit.can('validate pattern matchings')) {
        notify.error('You do not have permission to validate the matched rois.');
        return;
      }

      if (validation === undefined) {
        validation = (this.validation || {
          value: null
        }).value;
      }

      if (rois === undefined) {
        rois = [];
        this.forEachRoi(function (roi) {
          if (roi.selected) {
            rois.push(roi);
          }
        });
      }

      var roiIds = rois.map(function (roi) {
        return roi.id;
      });
      var val_delta = {
        conflict_unresolved: 0,
        conflict_resolved: 0,
        null: 0,
        0: 0,
        1: 0
      };
      return a2CitizenScientistExpertService.validatePatternMatchingRois(this.id, roiIds, validation).then(function () {
        rois.forEach(function (roi) {
          var oldtag, newtag;

          if (roi.cs_val_present > 0 && roi.cs_val_not_present > 0) {
            oldtag = roi.expert_validated !== null ? 'conflict_resolved' : 'conflict_unresolved';
            newtag = validation !== null ? 'conflict_resolved' : 'conflict_unresolved';
          }

          val_delta[oldtag] -= 1;
          val_delta[newtag] += 1;
          val_delta[roi.expert_validated] -= 1;
          val_delta[validation] += 1;
          roi.expert_validated = validation;
          roi.selected = false;
        });
        this.patternMatching.cs_conflict_resolved += val_delta.conflict_resolved;
        this.patternMatching.cs_conflict_unresolved += val_delta.conflict_unresolved;
        this.patternMatching.expert_consensus_absent += val_delta[0];
        this.patternMatching.expert_consensus_present += val_delta[1];
        this.loadPage(this.selected.page);
      }.bind(this));
    },
    nextMatch: function (step) {
      return this.setRoi(this.selected.roi_index + (step || 1));
    },
    prevMatch: function (step) {
      return this.setRoi(this.selected.roi_index - (step || 1));
    },
    nextPage: function (step) {
      return this.setPage(this.selected.page + (step || 1));
    },
    prevPage: function (step) {
      return this.setPage(this.selected.page - (step || 1));
    },
    next: function (step) {
      if (!step) {
        step = 1;
      }

      this.nextPage(step);
    },
    prev: function (step) {
      if (!step) {
        step = 1;
      }

      return this.next(-step);
    }
  });
  this.initialize($scope.patternMatchingId);
}]);
angular.module('a2.citizen-scientist.my-stats', ['a2.services', 'a2.directives', 'ui.bootstrap', 'a2.srv.citizen-scientist-admin', 'angularFileUpload', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('citizen-scientist.my-stats', {
    url: '/my-stats',
    controller: 'A2CitizenScientistMyStatsCtrl as controller',
    templateUrl: '/app/citizen-scientist/my-stats/index.html'
  });
}]).controller('A2CitizenScientistMyStatsCtrl', ["$scope", "a2CitizenScientistService", "$stateParams", "$state", "Users", function ($scope, a2CitizenScientistService, $stateParams, $state, Users) {
  this.loadPage = function () {
    this.loading = true;
    a2CitizenScientistService.getMyStats().then(function (data) {
      this.loading = false;
      var vars = ['validated', 'consensus', 'non_consensus', 'pending', 'reached_th'];
      this.stats = data.stats.map(function (item, index) {
        vars.forEach(function (_var) {
          item['group_' + _var] = data.groupStats[index][_var];
        });
        return item;
      });
      this.overall = data.stats.reduce(function (_, item) {
        vars.forEach(function (_var) {
          _[_var] += item[_var];
          _['group_' + _var] += item['group_' + _var];
        });
        return _;
      }, vars.reduce(function (__, _var) {
        __[_var] = 0;
        __['group_' + _var] = 0;
        return __;
      }, {})); // compute overalls
    }.bind(this));
  };

  this.loadPage();
}]);
angular.module('a2.citizen-scientist.patternmatching', ['ui.bootstrap', 'a2.srv.patternmatching', 'a2.srv.citizen-scientist', 'a2.visualizer.audio-player', 'a2.services', 'a2.permissions', 'humane', 'c3-charts']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('citizen-scientist.patternmatching', {
    url: '/patternmatching',
    controller: 'CitizenScientistPatternMatchingCtrl',
    templateUrl: '/app/citizen-scientist/patternmatching/list.html'
  });
  $stateProvider.state('citizen-scientist.patternmatching-details', {
    url: '/patternmatching/:patternMatchingId?',
    controller: 'CitizenScientistPatternMatchingCtrl',
    templateUrl: '/app/citizen-scientist/patternmatching/list.html'
  });
}]).controller('CitizenScientistPatternMatchingCtrl', ["$scope", "$filter", "Project", "ngTableParams", "a2Playlists", "notify", "$q", "a2CitizenScientistService", "a2PatternMatching", "a2UserPermit", "$state", "$stateParams", function ($scope, $filter, Project, ngTableParams, a2Playlists, notify, $q, a2CitizenScientistService, a2PatternMatching, a2UserPermit, $state, $stateParams) {
  $scope.selectedPatternMatchingId = $stateParams.patternMatchingId;

  var initTable = function (p, c, s, f, t) {
    var sortBy = {};
    var acsDesc = 'desc';

    if (s[0] == '+') {
      acsDesc = 'asc';
    }

    sortBy[s.substring(1)] = acsDesc;
    var tableConfig = {
      page: p,
      count: c,
      sorting: sortBy,
      filter: f
    };
    $scope.tableParams = new ngTableParams(tableConfig, {
      total: t,
      getData: function ($defer, params) {
        $scope.infopanedata = "";
        var filteredData = params.filter() ? $filter('filter')($scope.patternmatchingsOriginal, params.filter()) : $scope.patternmatchingsOriginal;
        var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.patternmatchingsOriginal;
        params.total(orderedData.length);
        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

        if (orderedData.length < 1) {
          $scope.infopanedata = "No Pattern matchings searches found.";
        }

        $scope.patternmatchingsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
      }
    });
  };

  $scope.getTemplateVisualizerUrl = function (template) {
    var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
    return template ? "/project/" + template.source_project_uri + "/visualizer/rec/" + template.recording + "?a=" + box : '';
  }, $scope.selectItem = function (patternmatchingId) {
    $scope.selectedPatternMatchingId = patternmatchingId;

    if (!patternmatchingId) {
      $state.go('citizen-scientist.patternmatching', {});
    } else {
      $state.go('citizen-scientist.patternmatching-details', {
        patternMatchingId: patternmatchingId
      });
    }
  };

  $scope.loadPatternMatchings = function () {
    $scope.loading = true;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    return a2CitizenScientistService.getPatternMatchings().then(function (data) {
      $scope.patternmatchingsOriginal = data;
      $scope.patternmatchingsData = data;
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
      $scope.infopanedata = "";

      if (data.length > 0) {
        if (!$scope.tableParams) {
          initTable(1, 10, "+cname", {}, data.length);
        } else {
          $scope.tableParams.reload();
        }
      } else {
        $scope.infopanedata = "No pattern matchings found.";
      }
    });
  };

  if (!$scope.selectedPatternMatchingId) {
    $scope.loadPatternMatchings();
  }
}]).directive('a2CitizenScientistPatternMatchingDetails', function () {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      patternMatchingId: '=',
      onGoBack: '&'
    },
    controller: 'CitizenScientistPatternMatchingDetailsCtrl',
    controllerAs: 'controller',
    templateUrl: '/app/citizen-scientist/patternmatching/details.html'
  };
}).controller('CitizenScientistPatternMatchingDetailsCtrl', ["$scope", "a2PatternMatching", "a2Templates", "a2CitizenScientistService", "a2UserPermit", "Project", "a2AudioBarService", "notify", function ($scope, a2PatternMatching, a2Templates, a2CitizenScientistService, a2UserPermit, Project, a2AudioBarService, notify) {
  Object.assign(this, {
    id: null,
    initialize: function (patternMatchingId) {
      this.id = patternMatchingId;
      this.offset = 0;
      this.limit = 100;
      this.selected = {
        roi_index: 0,
        roi: null,
        page: 0
      };
      this.total = {
        rois: 0,
        pages: 0
      };
      this.loading = {
        details: false,
        rois: false
      };
      this.validation = this.lists.validation[2];
      this.thumbnailClass = this.lists.thumbnails[0].value;
      this.projecturl = Project.getUrl();
      this.fetchDetails().then(function () {
        this.loadPage(this.selected.page);
      }.bind(this));
    },
    lists: {
      thumbnails: [{
        class: 'fa fa-th-large',
        value: ''
      }, {
        class: 'fa fa-th',
        value: 'is-small'
      }],
      selection: [{
        value: 'all',
        text: 'All'
      }, {
        value: 'none',
        text: 'None'
      } // {value:'not-validated', text:'Not Validated'},
      ],
      validation: [{
        class: "fa val-1",
        text: "Present",
        value: 1
      }, {
        class: "fa val-0",
        text: "Not Present",
        value: 0
      }, {
        class: "fa val-null",
        text: "Clear",
        value: null
      }]
    },
    fetchDetails: function () {
      this.loading.details = true;
      return a2CitizenScientistService.getPatternMatchingDetailsFor(this.id).then(function (patternMatching) {
        this.loading.details = false;
        this.patternMatching = patternMatching;
        this.setupExportUrl();
        this.total = {
          rois: patternMatching.cs_total,
          pages: Math.ceil(patternMatching.cs_total / this.limit)
        };
      }.bind(this)).catch(function (err) {
        this.loading.details = false;
        return notify.serverError(err);
      }.bind(this));
    },
    setupExportUrl: function () {
      this.patternMatchingExportUrl = a2PatternMatching.getExportUrl({
        patternMatching: this.patternMatching.id
      });
    },
    onScroll: function ($event, $controller) {
      this.scrollElement = $controller.scrollElement;
      var scrollPos = $controller.scrollElement.scrollY;
      var headerTop = $controller.anchors.header.offset().top;
      this.headerTop = headerTop | 0;
      this.scrolledPastHeader = scrollPos >= headerTop;
    },
    onSelect: function ($item) {
      this.select($item.value);
    },
    loadPage: function (pageNumber) {
      this.loading.rois = true;
      return a2CitizenScientistService.getPatternMatchingRoisFor(this.id, this.limit, pageNumber * this.limit).then(function (rois) {
        this.loading.rois = false;
        this.rois = rois.reduce(function (_, roi) {
          var sitename = roi.site;
          var recname = roi.recording;

          if (!_.idx[sitename]) {
            _.idx[sitename] = {
              list: [],
              idx: {},
              name: sitename
            };

            _.list.push(_.idx[sitename]);
          }

          var site = _.idx[sitename];
          site.list.push(roi);
          return _;
        }, {
          list: [],
          idx: {}
        }).list;
        this.selected.roi = Math.min();

        if (this.scrollElement) {
          this.scrollElement.scrollTo(0, 0);
        }

        return rois;
      }.bind(this)).catch(function (err) {
        this.loading.rois = false;
        return notify.serverError(err);
      }.bind(this));
    },
    playRoiAudio: function (roi, $event) {
      if ($event) {
        $event.preventDefault();
        $event.stopPropagation();
      }

      a2AudioBarService.loadUrl(a2PatternMatching.getAudioUrlFor(roi), true);
    },
    playTemplateAudio: function () {
      a2AudioBarService.loadUrl(a2Templates.getAudioUrlFor(this.patternMatching.template), true);
    },
    getRoiVisualizerUrl: function (roi) {
      var box = ['box', roi.x1, roi.y1, roi.x2, roi.y2].join(',');
      return roi ? "/project/" + this.projecturl + "/visualizer/rec/" + roi.recording_id + "?a=" + box : '';
    },
    getTemplateVisualizerUrl: function (template) {
      var box = ['box', template.x1, template.y1, template.x2, template.y2].join(',');
      return template ? "/project/" + template.source_project_uri + "/visualizer/rec/" + template.recording + "?a=" + box : '';
    },
    setRoi: function (roi_index) {
      if (this.total.rois <= 0) {
        this.selected.roi_index = 0;
        this.selected.roi = null;
      } else {
        this.selected.roi_index = Math.max(0, Math.min(roi_index | 0, this.total.rois - 1));
        this.selected.roi = this.rois[this.selected.roi_index];
      }

      return this.selected.roi;
    },
    setPage: function (page, force) {
      if (this.total.rois <= 0) {
        this.selected.page = 0;
        this.rois = [];
        return this.rois;
      } else {
        page = Math.max(0, Math.min(page, this.total.rois / this.limit | 0));

        if (page != this.selected.page || force) {
          this.selected.page = page;
          return this.loadPage(page);
        }
      }
    },
    select: function (option) {
      var selectFn = null;

      if (option === "all") {
        selectFn = function (roi) {
          roi.selected = true;
        };
      } else if (option === "none") {
        selectFn = function (roi) {
          roi.selected = false;
        };
      } else if (option === "not-validated") {
        selectFn = function (roi) {
          roi.selected = roi.cs_validated === null;
        };
      } else {
        selectFn = function (roi) {
          roi.selected = roi.id === option;
        };
      }

      this.forEachRoi(selectFn);
    },
    forEachRoi: function (fn) {
      (this.rois || []).forEach(function (site) {
        site.list.forEach(fn);
      });
    },
    validate: function (validation, rois) {
      if (!a2UserPermit.can('use citizen scientist interface')) {
        notify.error('You do not have permission to validate the matched rois.');
        return;
      }

      if (validation === undefined) {
        validation = (this.validation || {
          value: null
        }).value;
      }

      if (rois === undefined) {
        rois = [];
        this.forEachRoi(function (roi) {
          if (roi.selected) {
            rois.push(roi);
          }
        });
      }

      var roiIds = rois.map(function (roi) {
        return roi.id;
      });
      var val_delta = {
        0: 0,
        1: 0,
        null: 0
      };
      rois.forEach(function (roi) {
        val_delta[roi.cs_validated] -= 1;
        val_delta[validation] += 1;
        roi.cs_validated = validation;
        roi.selected = false;
      });
      this.patternMatching.cs_absent += val_delta[0];
      this.patternMatching.cs_present += val_delta[1];
      return a2CitizenScientistService.validatePatternMatchingRois(this.id, roiIds, validation);
    },
    nextMatch: function (step) {
      return this.setRoi(this.selected.roi_index + (step || 1));
    },
    prevMatch: function (step) {
      return this.setRoi(this.selected.roi_index - (step || 1));
    },
    nextPage: function (step) {
      return this.setPage(this.selected.page + (step || 1));
    },
    prevPage: function (step) {
      return this.setPage(this.selected.page - (step || 1));
    },
    next: function (step) {
      if (!step) {
        step = 1;
      }

      this.nextPage(step);
    },
    prev: function (step) {
      if (!step) {
        step = 1;
      }

      return this.next(-step);
    }
  });
  this.initialize($scope.patternMatchingId);
}]);
angular.module('a2.visobjectsbrowser', ['a2.utils', 'a2.browser_common', 'a2.browser_recordings', 'a2.browser_soundscapes', 'a2.service.serialize-promised-fn'])
/**
 * @ngdoc directive
 * @name a2visobjectsbrowser.directive:a2VisObjectBrowser
 * @description
 * vis object browser component.
 *
 * @event browser-available Emmited when the browser controller gets initialized
 * @event browser-vobject-type Emmited when the selected visualizer object type changes
 *
 */
.directive('a2VisObjectBrowser', ["$window", "$timeout", function ($window, $timeout) {
  return {
    restrict: 'E',
    scope: {
      location: '=?',
      onVisObject: '&'
    },
    templateUrl: '/app/visualizer/browser/main.html',
    // require: 'ngModel',
    controller: 'a2VisObjectBrowserController as browser',
    link: function (scope, element, attrs, browser) {
      browser.waitForInitialized.then(function () {
        scope.$emit('browser-available');
      });
      browser.events.on('location-changed', function () {
        scope.location = this.location;
      });
      browser.events.on('browser-vobject-type', function (vobject_type) {
        scope.$emit('browser-vobject-type', vobject_type);
      });
      browser.events.on('on-vis-object', function (location, visobject, type) {
        scope.onVisObject({
          location: location,
          visobject: visobject,
          type: type
        });
        $timeout(function () {
          var $e = element.find('.visobj-list-item.active');

          if ($e.length) {
            var $p = $e.parent();
            var $eo = $e.offset(),
                $po = $p.offset(),
                $dt = $eo.top - $po.top;
            $p.animate({
              scrollTop: $p.scrollTop() + $dt
            });
          }
        });
      });
      scope.selectVisObject = browser.selectVisObject.bind(browser); // scope.$on('a2-persisted', browser.activate.bind(browser));

      scope.$on('prev-visobject', browser.selectPreviousVisObject.bind(browser));
      scope.$on('next-visobject', browser.selectNextVisObject.bind(browser));
      scope.$on('set-browser-location', browser.setBrowserLocation.bind(browser)); // Catch the navigation URL query from visualizer view

      scope.$on('set-browser-annotations', browser.setBrowserAnnotations.bind(browser));
      scope.$on('clear-recording-data', browser.clearRecordingData.bind(browser));
      scope.$on('visobj-updated', browser.notifyVisobjUpdated.bind(browser));
      browser.activate(scope.location).catch(console.error.bind(console));
    }
  };
}])
/**
 * @ngdoc controller
 * @name a2visobjectsbrowser.controller:a2VisObjectBrowserController
 * @description
 * Controller for vis object browser.
 *
 * @event browser-available Emmited when the browser controller gets initialized
 * @event browser-vobject-type Emmited when the selected visualizer object type changes
 *
 */
.controller('a2VisObjectBrowserController', ["$scope", "$state", "$controller", "$q", "serializePromisedFn", "BrowserLOVOs", "BrowserVisObjects", "itemSelection", "Project", "EventlistManager", function ($scope, $state, $controller, $q, serializePromisedFn, BrowserLOVOs, BrowserVisObjects, itemSelection, Project, EventlistManager) {
  var self = this;
  var project = Project; // Set of available lovo types

  this.types = BrowserLOVOs.$grouping;
  this.visobjectTypes = BrowserVisObjects; // currently selected lovo type
  // container for loading flags

  this.loading = {
    sites: false,
    dates: false,
    times: false
  }; // container for auto-selecting values from the browser controllers

  this.auto = {}; // currently selected visualizer object

  this.visobj = null; // currently selected lovo

  this.lovo = null; // associated EventlistManager

  this.events = new EventlistManager(); // initialized flag

  var initialized = false;
  var waitForInitializedDefer = $q.defer();
  this.waitForInitialized = waitForInitializedDefer.promise;
  this.waitForInitialized.then(function () {
    if (!this.type) {
      this.setBrowserType(BrowserLOVOs.$list.filter(function (lovo) {
        return lovo.default;
      }).shift());
    }
  }.bind(this));
  /** (Re)-Activates the browser controller.
   * Sets the browser controller into an active state. On the first time,
   * the browse gets initialized and sends a 'browser-available' event
   * asynchronously. This activation cascades into the currently selected
   * type.
   *
   * @event browser-available Emmited when the browser controller gets initialized
   *
   */

  this.activate = function (location) {
    var $type = this.$type;
    return ($type && $type.activate ? $type.activate().then(function () {
      if ($scope.browser.currentRecording && $scope.browser.annotations) {
        return this.setLOVO();
      }

      if ($type.lovo) return this.setLOVO($type.lovo);
    }.bind(this)) : $q.resolve()).then(function () {
      if (!initialized) {
        initialized = true;
        waitForInitializedDefer.resolve();
      }
    }.bind(this));
  };

  this.setLOVO = function (lovo, location) {
    var defer = $q.defer();
    var old_lovo = self.lovo;
    self.lovo = lovo;
    if (self.lovo) self.lovo.loading = true;
    return $q.resolve().then(function () {
      if (lovo) {
        self.lovo.loading = false;

        if (lovo.recordingsBySite) {
          lovo.updateRecording($scope.browser.currentRecording ? $scope.browser.currentRecording : undefined);
        }

        lovo.initialize().then(function () {
          if (location) {
            self.set_location(location);
          }
        }).then(function () {
          // to set selected recording from the list of recordings
          if (lovo.recordingsBySite && lovo.list && lovo.recording_id) {
            self.auto.visobject = lovo.list.find(function (item) {
              return item.id === self.auto.visobject.id;
            });
          }

          if (self.auto.visobject) {
            return lovo.find(self.auto.visobject).then(function (visobject) {
              return self.setVisObj(visobject);
            });
          }
        }).then(function () {
          return $q.resolve(lovo);
        });
      }
    });
  };

  this.set_location = function (location) {
    this.location = location;
    this.events.send({
      event: 'location-changed',
      context: this
    }, location);
  };

  this.setBrowserType = serializePromisedFn(function (type) {
    var new_$type,
        old_$type = self.$type;

    if (type && type.controller) {
      if (!type.$controller) {
        type.$controller = $controller(type.controller, {
          $scope: $scope,
          a2Browser: self
        });
      }

      new_$type = type.$controller;
    }

    var differ = new_$type !== old_$type;
    return (differ ? $q.resolve().then(function () {
      if (differ && old_$type && old_$type.deactivate) {
        return old_$type.deactivate();
      }
    }).then(function () {
      if (differ && new_$type && new_$type.activate) {
        self.type = type;
        self.$type = new_$type;
        return self.activate();
      }
    }) : $q.resolve()).then(function () {
      self.events.send({
        'event': 'browser-vobject-type',
        context: self
      }, type.vobject_type);
    });
  });

  this.setVisObj = function (newValue) {
    this.visobj = newValue;
    var location = newValue && self.$type.get_location(newValue);
    this.cachedLocation = location;
    this.events.send({
      event: 'on-vis-object',
      context: this
    }, location, newValue, self.lovo ? self.lovo.object_type : null);
  };

  this.selectVisObject = function (visobject) {
    console.log("this.selectVisObject :: ", visobject);
    return visobject ? $q.resolve().then(function () {
      return self.lovo && self.lovo.find(visobject);
    }).then(function (vobj) {
      return vobj || visobject;
    }).then(function (vobj) {
      self.auto = {
        visobject: vobj
      };

      if (self.$type.auto_select) {
        return self.$type.auto_select(visobject);
      } else {
        return self.setVisObj(visobject);
      }
    }) : $q.resolve();
  };

  this.selectPreviousVisObject = function () {
    // console.log("this.selectPreviousVisObject = function(){");
    if (self.visobj && self.lovo) {
      self.lovo.previous(self.visobj.id).then(this.selectVisObject.bind(this));
    }
  };

  this.selectNextVisObject = function () {
    console.log("this.selectNextVisObject = function(){");

    if (self.visobj && self.lovo) {
      self.lovo.next(self.visobj.id).then(this.selectVisObject.bind(this));
    }
  }; // Parse the navigation URL query


  this.setBrowserAnnotations = function (evt, recording, query) {
    this.annotations = query;
    this.currentRecording = recording;
  };

  this.clearRecordingData = function (evt, data) {
    this.currentRecording = null;
  };

  this.setBrowserLocation = function (evt, location) {
    var m = /([\w-+]+)(\/(.+))?/.exec(location);

    if (this.cachedLocation == location) {
      return $q.resolve();
    }

    this.cachedLocation = location;

    if (m && BrowserLOVOs[m[1]]) {
      var loc = m[3];
      var lovos_def = BrowserLOVOs[m[1]];
      this.setBrowserType(lovos_def).then(function () {
        return lovos_def.$controller.resolve_location(loc);
      }).then(function (visobject) {
        if (visobject) {
          return self.selectVisObject(visobject);
        }
      });
    }
  };

  this.notifyVisobjUpdated = function (evt, visobject) {
    if (self.lovo && self.lovo.update) {
      self.lovo.update(visobject);
    }
  };
}]);
angular.module('a2.browser_common', []).provider('BrowserVisObjects', function () {
  var visobjects = {};
  return {
    add: function (visobject) {
      visobjects[visobject.type] = angular.extend(visobjects[visobject.type] || {}, visobject);
    },
    $get: function () {
      return visobjects;
    }
  };
}).provider('BrowserLOVOs', function () {
  var lovos = {
    $grouping: [],
    $list: []
  };
  return {
    add: function (lovo) {
      lovos.$list.push(lovo);
    },
    $get: function () {
      lovos.$grouping = lovos.$list.reduce(function (_, lovodef) {
        var group = lovodef.group || '';

        if (!_.$index[group]) {
          _.groups.push(_.$index[group] = []);
        }

        _.$index[group].push(lovos[lovodef.name] = lovodef);

        return _;
      }, {
        groups: [],
        $index: {}
      }).groups;
      return lovos;
    }
  };
}).service('a2ArrayLOVO', ["$q", function ($q) {
  var lovo = function (list, object_type) {
    this.offset = 0;
    this.setArray(list, object_type);
  };

  lovo.prototype = {
    initialize: function () {
      var d = $q.defer();
      d.resolve(true);
      return d.promise;
    },
    setArray: function (list, object_type) {
      this.list = list || [];
      this.count = this.list.length;
      this.object_type = object_type;
    },
    find: function (soundscape) {
      var d = $q.defer(),
          id = soundscape && soundscape.id || soundscape | 0;
      d.resolve(this.list.filter(function (r) {
        return r.id == id;
      }).shift());
      return d.promise;
    },
    previous: function (soundscape) {
      var d = $q.defer(),
          id = soundscape && soundscape.id || soundscape | 0;
      var index = 0;

      for (var l = this.list, i = 0, e = l.length; i < e; ++i) {
        if (s.id == id) {
          index = Math.min(Math.max(0, i - 1, this.list.length - 1));
          break;
        }
      }

      d.resolve(this.list[index]);
      return d.promise;
    },
    next: function (recording) {
      var d = $q.defer(),
          id = soundscape && soundscape.id || soundscape | 0;
      var index = 0;

      for (var l = this.list, i = 0, e = l.length; i < e; ++i) {
        if (s.id == id) {
          index = Math.min(Math.max(0, i + 1, this.list.length - 1));
          break;
        }
      }

      d.resolve(this.list[index]);
      return d.promise;
    }
  };
  return lovo;
}]);
/**
 * @ngdoc overview
 * @name dialog
 * @description
 * Visualizer dialog window module.
 */
angular.module('a2.visualizer.dialog', []).directive('a2VisualizerDialog', function () {
  return {
    restrict: 'E',
    transclude: true,
    templateUrl: '/app/visualizer/dialog/dialog.html',
    scope: {
      show: '=',
      x1: '=',
      y1: '=',
      x2: '=',
      y2: '='
    },
    controller: 'a2VisualizerDialogCtrl'
  };
}).controller('a2VisualizerDialogCtrl', ["$scope", function ($scope) {
  $scope.layout = $scope.$parent.layout;

  $scope.getXSide = function (x1, x2) {
    var px = Math.max(0, Math.min($scope.layout.sec2x(x2, 1) / $scope.layout.spectrogram.width, 1));
    return px > .5 ? 'left' : 'right';
  };

  $scope.getXCoord = function (x1, x2) {
    return $scope.getXSide(x1, x2) == 'left' ? x1 : x2;
  };

  $scope.getTransform = function (x1, x2, y1, y2) {
    var tx = $scope.getXSide(x1, x2) == 'left' ? '-100%' : '0';
    var ty = $scope.getYTranslation((y1 + y2) / 2, true);
    return 'translate(' + tx + ', ' + ty + ')';
  };

  $scope.getYTranslation = function (y, asrelativeoffset) {
    var py = Math.max(0.1, Math.min($scope.layout.hz2y(y, 1) / $scope.layout.spectrogram.height, .9));

    if (asrelativeoffset) {
      py = -py;
    }

    return (100 * py | 0) + '%';
  };
}]);
angular.module('a2.visualizer.layers.recording-tags', ['a2.srv.tags']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layer.recording-tags.object:recording-tags-layer
   * @description Recording tags layer.
   * adds the recording-tags-layer layer_type to layer_types. This layer uses
   * a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController as controller,
   * and requires a visobject of type recording to be selected.
   * The layer has no visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "recording-tags-layer",
    title: "",
    controller: 'a2VisualizerRecordingTagsLayerController as controller',
    require: {
      type: 'recording',
      selection: true
    },
    visible: true,
    hide_visibility: true
  });
}])
/**
 * @ngdoc controller
 * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController
 * @description Controller for recording tags layer in visualizer.
 * Gets injected an instance of VisualizerCtrl representing the visualizer control.
 * Responds to VisualizerCtrl.event::visobject by loading the visobject tags, if it is a
 * recording.
 */
.controller('a2VisualizerRecordingTagsLayerController', ["VisualizerCtrl", "a2Tags", "a2LookaheadHelper", "a22PointBBoxEditor", "$q", "$debounce", function (VisualizerCtrl, a2Tags, a2LookaheadHelper, a22PointBBoxEditor, $q, $debounce) {
  function makeTagsIndex(tags) {
    return tags.reduce(function (idx, tag) {
      if (tag.id) {
        idx[tag.id] = true;
      }

      return idx;
    }, {});
  }

  function groupByBbox(tags) {
    var bboxes = [];
    tags.reduce(function (bboxIdx, tag) {
      if (tag.f0) {
        var bbox = [tag.t0, tag.f0, tag.t1, tag.f1];
        var bbox_key = bbox.join(',');

        if (!bboxIdx[bbox_key]) {
          bboxes.push(bboxIdx[bbox_key] = {
            bbox: tag,
            tags: []
          });
        }

        bboxIdx[bbox_key].tags.push(tag);
      }

      return bboxIdx;
    }, {});
    return bboxes;
  }

  var lookaheadHelper = new a2LookaheadHelper({
    fn: a2Tags.search,
    minLength: 3,
    includeSearch: true,
    searchPromote: function (text) {
      return {
        tag: text
      };
    },
    searchCompare: function (text, tag) {
      return tag.tag == text;
    }
  });
  this.tags = [];
  this.spectrogramTags = [];
  this.tagsIndex = {};
  this.bboxTags = [];
  this.bboxTagsIndex = {};
  /**
   * @ngdoc method
   * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#setVisobject
   * @description Sets the visobject that will be the focus of this controller.
   * Causes tags associated to it to be loaded.
   * @param {visobject} visobject - visobject to set on the controller.
   * @return Promise resolved with tags of given visobject. If the visobject is
   * not a recording, then the promise resolves to an empty array.
   */

  this.setVisobject = function (visobject) {
    this.visobject = visobject;
    return this.loadTags();
  };
  /**
   * @ngdoc method
   * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#loadTags
   * @description Loads the tags for a given visobject and returns them in a promise.
   * @param {visobject} visobject - visobject for wich to load the tags. Must be a recording visobject.
   * @return Promise resolved with tags of given visobject. If the visobject is
   * not a recording, then the promise resolves to an empty array.
   */


  this.loadTags = function () {
    var visobject = this.visobject;

    if (!visobject || !/^recording$/.test(visobject.type)) {
      this.tags = [];
      return $q.resolve(this.tags);
    }

    this.loading = true;
    this.visobject = visobject;
    return a2Tags.getFor(visobject).then(function (tags) {
      this.tagsIndex = makeTagsIndex(tags);
      this.spectrogramTags = groupByBbox(tags);
      this.tags = tags;
      return tags;
    }.bind(this)).finally(function () {
      this.loading = false;
    }.bind(this));
  };
  /**
   * @ngdoc object
   * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#searchedTags
   * @description Array of tags returned by the last tag search.
   */


  this.searchedTags = [];
  /**
   * @ngdoc method
   * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#searchTags
   * @description Searched for tags using the given text.
   * @param {String} text - text to match in the tags search.
   * @return Promise resolved with the searched tags. Also, searched tags are set in searchedTags.
   */

  this.searchTags = function (text) {
    if (text === '' || !text) {
      this.getProjectTags();
    }

    return lookaheadHelper.search(text).then(function (tags) {
      this.searchedTags = tags;
    }.bind(this));
  };
  /**
   * @ngdoc method
   * @name a2.visualizer.layer.recording-tags.controller:a2VisualizerRecordingTagsLayerController#onTagListChanged
   * @description Called whenever the list of tags needs to be checked for changes.
   * @return Promise resolved whenever the list of tags has been checked entirely.
   */


  this.onTagListChanged = $debounce(function () {
    var tagUpdate = this.determineTagUpdate(this.tags, this.tagsIndex);
    return this.updateTags(tagUpdate);
  }, 100);
  this.onBBoxTagListChanged = $debounce(function () {
    var tagUpdate = this.determineTagUpdate(this.bboxTags);
    this.bboxTags = [];
    var bbox = this.bbox.bbox;
    tagUpdate.add.forEach(function (tag) {
      tag.t0 = bbox.x1;
      tag.f0 = bbox.y1;
      tag.t1 = bbox.x2;
      tag.f1 = bbox.y2;
    });
    return this.updateTags(tagUpdate).then;
  });

  this.getProjectTags = function () {
    return a2Tags.getForType('recording').then(function (tags) {
      this.searchedTags = tags;
    }.bind(this));
  };

  this.getProjectTags();

  this.determineTagUpdate = function (tags, oldTagsIndex) {
    var tagsIndex = makeTagsIndex(tags);
    var toDelete = Object.keys(oldTagsIndex || {}).filter(function (tagId) {
      return !tagsIndex[tagId];
    });
    var toAdd = tags.filter(function (tag) {
      return !tag.id;
    });
    return {
      add: toAdd,
      delete: toDelete
    };
  };

  this.updateTags = function (tagUpdate) {
    var visobject = this.visobject;
    console.log("visobject : ", visobject);
    console.log("tag update : ", tagUpdate);
    return $q.all([$q.all(tagUpdate.delete.map(function (tagId) {
      return a2Tags.deleteFor(visobject, tagId);
    })), $q.all(tagUpdate.add.map(function (tag) {
      return a2Tags.addFor(visobject, tag);
    }))]).then(function (updateResponse) {
      return this.loadTags();
    }.bind(this)).catch(function () {
      // TODO:: notify user of failure... maybe should be done through a notification service...
      return this.loadTags();
    }.bind(this));
  };

  this.bbox = angular.extend(new a22PointBBoxEditor(), {
    add_tracer_point: function (point) {
      this.super.add_tracer_point.call(this, point.sec, point.hz);
    },
    add_point: function (point, min_eps) {
      this.super.add_point.call(this, point.sec, point.hz, min_eps);
    },
    resetBboxTags: function () {
      console.log("resetBboxTags", this.bboxTags);
      this.bboxTags = [];
    }.bind(this),
    reset: function () {
      this.resetBboxTags();
      this.super.reset.call(this);
    }
  });
  VisualizerCtrl.on('visobject', this.setVisobject.bind(this));
}]).directive('a2Tag', function () {
  return {
    restrict: 'E',
    scope: {
      tag: '='
    },
    template: '<span class="fa fa-tag no-text-wrap">' + '{{tag.tag}}' + '</span>'
  };
});
angular.module('a2.visualizer.layers.soundscape-composition-tool', ['a2.srv.soundscape-composition', 'arbimon2.directive.validation-dropdown']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layer.soundscape-composition-tool.object:soundscape-composition-tool
   * @description Recording tags layer.
   * adds the soundscape-composition-tool layer_type to layer_types. This layer uses
   * a2.visualizer.layer.soundscape-composition-tool.controller:a2VisualizerSoundscapeCompositionToolController as controller,
   * and requires a visobject of type recording to be selected.
   * The layer has no visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "soundscape-composition-tool",
    title: "",
    controller: 'a2VisualizerSoundscapeCompositionToolController as controller',
    display: {
      spectrogram: false
    },
    require: {
      type: 'recording',
      selection: true
    },
    visible: true,
    hide_visibility: true
  });
}])
/**
 * @ngdoc controller
 * @name a2.visualizer.layer.soundscape-composition-tool.controller:a2VisualizerSoundscapeCompositionToolController
 * @description Controller for recording tags layer in visualizer.
 * Gets injected an instance of VisualizerCtrl representing the visualizer control.
 * Responds to VisualizerCtrl.event::visobject by loading the visobject tags, if it is a
 * recording.
 */
.controller('a2VisualizerSoundscapeCompositionToolController', ["$q", "VisualizerCtrl", "a2UserPermit", "notify", "a2SoundscapeCompositionService", function ($q, VisualizerCtrl, a2UserPermit, notify, a2SoundscapeCompositionService) {
  this.initialize = function () {
    VisualizerCtrl.on('visobject', this.setVisobject.bind(this));
    a2SoundscapeCompositionService.getClassList({
      groupByType: true,
      isSystemClass: 1
    }).then(function (classesByType) {
      this.classTypes = classesByType;
      this.classesByType = classesByType.reduce(function (_, type) {
        _[type.type] = type;
        return _;
      }, {});
    }.bind(this));
    this.annotations = {};
    this.annotationToolbar = [[{
      value: 1,
      caption: "Annotate as Present"
    }, {
      value: 0,
      caption: "Annotate as Absent"
    }], [{
      value: 2,
      caption: "Clear Annotation"
    }]];
  };

  this.annotate = function (val, classId) {
    if (!a2UserPermit.can('validate species')) {
      notify.error('You do not have permission to add soundscape composition annotations.');
      return;
    }

    var keys = [classId];

    if (keys.length > 0) {
      a2SoundscapeCompositionService.annotate(this.visobject, {
        'class': keys.join(','),
        val: val
      }).then(function (annotations) {
        this.is_selected = {};
        annotations.forEach(function (annotation) {
          if (annotation.present == 2) {
            delete this.annotations[annotation.scclassId];
          } else {
            this.annotations[annotation.scclassId] = annotation.present;
          }
        }.bind(this));
      }.bind(this));
    }
  };

  this.setVisobject = function (visobject) {
    this.visobject = visobject;
    return this.loadAnnotations();
  };

  this.loadAnnotations = function () {
    var visobject = this.visobject;

    if (!visobject || !/^recording$/.test(visobject.type)) {
      this.annotations = {};
      return $q.resolve(this.annotations);
    }

    this.loading = true;
    this.visobject = visobject;
    return a2SoundscapeCompositionService.getAnnotationsFor(visobject).then(function (annotations) {
      this.annotations = annotations;
      return annotations;
    }.bind(this)).finally(function () {
      this.loading = false;
    }.bind(this));
  };

  this.initialize();
}]);
angular.module('a2.visualizer.layers.templates', ['visualizer-services', 'a2.utils']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.templates.object:templates
   * @description Templates layer.
   * adds the templates layer_type to layer_types. This layer uses
   * a2.visualizer.layers.templates.controller:a2VisualizerTemplateLayerController as controller,
   * and requires a visobject of type recording to be selected.
   */
  layer_typesProvider.addLayerType({
    type: "templates",
    title: "",
    controller: 'a2VisualizerTemplateLayerController as templates',
    require: {
      type: 'recording',
      selection: true
    },
    visible: true
  });
}]).controller('a2VisualizerTemplateLayerController', ["$scope", "$modal", "$controller", "$state", "$timeout", "a2Templates", "a2UserPermit", "a22PointBBoxEditor", "Project", "notify", function ($scope, $modal, $controller, $state, $timeout, a2Templates, a2UserPermit, a22PointBBoxEditor, Project, notify) {
  var self = this;
  self.selected = null;
  self.templates = [];
  self.recordingTemplates = [];
  self.citizenScientistUser = a2UserPermit.all && a2UserPermit.all.length === 1 && a2UserPermit.all.includes('use citizen scientist interface') && !a2UserPermit.can('delete project') && !a2UserPermit.isSuper();
  Project.getClasses(function (project_classes) {
    self.project_classes = project_classes;
  });
  var getTemplatesPromise = a2Templates.getList({
    projectTemplates: true
  }).then(function (templates) {
    self.templates = templates;
    return templates;
  });

  self.updateState = function () {
    var rec = $scope.visobject && $scope.visobject_type == 'recording' && $scope.visobject.id;
    getTemplatesPromise.then(function () {
      self.recordingTemplates = self.templates.filter(function (template) {
        return template.recording == rec;
      });
    });
    self.editor.reset();
    self.editor.recording = rec;
  };

  self.goToSpeciesPage = function () {
    $state.go('audiodata.species', {});
  };

  self.editor = angular.extend(new a22PointBBoxEditor(), {
    reset: function () {
      this.super.reset.call(this);
      this.roi = null;
    },
    make_new_bbox: function () {
      this.super.make_new_bbox.call(this);
      this.roi = this.bbox;
    },
    make_new_roi: function () {
      this.make_new_bbox();
    },
    add_tracer_point: function (point) {
      this.super.add_tracer_point.call(this, point.sec, point.hz);
    },
    add_point: function (point, min_eps) {
      console.log('add_point : function(', point, ', ', min_eps, '){');
      this.super.add_point.call(this, point.sec, point.hz, min_eps);
    },
    get_placeholder_name: function () {
      return this.project_class ? this.project_class.species_name + ' ' + this.project_class.songtype_name : 'Template Name';
    },
    submit: function () {
      if (!a2UserPermit.can('manage templates')) {
        notify.error('You do not have permission to add a template');
        return;
      }

      if (!this.project_class.songtype_name && !this.project_class.species_name) {
        return;
      }

      this.submitting = true;
      a2Templates.add({
        name: this.template_name || this.project_class.species_name + " " + this.project_class.songtype_name,
        recording: this.recording,
        species: this.project_class.species,
        songtype: this.project_class.songtype,
        roi: this.roi
      }).then(function (new_template) {
        console.log('new_template', new_template);
        this.submitting = false;
        if (new_template.id === 0) return notify.error('The template with that name already exists for this record.');
        $timeout(function () {
          this.reset();
          self.templates.push(new_template);
          self.updateState();
        }.bind(this));
      }.bind(this));
    }
  });
  $scope.$watch('visobject', self.updateState);
}]) // .controller('a2VisualizerAddTemplateModalController', function($scope, $modalInstance, Project, a2Templates){
//     $scope.data = {
//         name : '',
//         type : null
//     };
//
//     $scope.loadingClasses = true;
//
//     Project.getClasses(function(project_classes){
//         $scope.project_classes = project_classes;
//         $scope.loadingClasses = false;
//     });
//
//     $scope.loadingTypes = true;
//
//     a2Templates.getTypes(function(template_types){
//         $scope.template_types = template_types;
//         if(template_types && template_types.length == 1) {
//             $scope.data.type = template_types[0];
//             $scope.loadingTypes = false;
//         }
//     });
//
//     $scope.ok = function(){
//         $scope.creating = true;
//         $scope.validation = {
//             count:0
//         };
//
//         var template_data = {};
//
//         if($scope.data.name){
//             template_data.name = $scope.data.name;
//         }
//         else {
//             $scope.validation.name = "Training set name is required.";
//             $scope.validation.count++;
//         }
//
//         if($scope.data.type && $scope.data.type.id){
//             template_data.type = $scope.data.type.identifier;
//         }
//         else {
//             $scope.validation.type = "Training set type is required.";
//             $scope.validation.count++;
//         }
//
//         if($scope.data.class) {
//             template_data.class = $scope.data.class.id;
//         }
//         else {
//             $scope.validation.class = "Species sound is required.";
//             $scope.validation.count++;
//         }
//
//         // $scope.form_data=template_data;
//
//         if($scope.validation.count ===  0) {
//             a2Templates.add(template_data, function(new_template) {
//                 if(new_template.error) {
//
//                     var field = new_template.field || 'error';
//
//                     $scope.validation[field] = new_template.error;
//
//                     return;
//                 }
//                 $modalInstance.close(new_template);
//             });
//         }
//         else {
//             $scope.creating = false;
//         }
//     };
// })
;
angular.module('a2.visobjects.audio-event-detection', ['a2.services', 'a2.visobjects.common', 'a2.service.plotly-plot-maker']).config(["VisualizerObjectTypesProvider", function (VisualizerObjectTypesProvider) {
  VisualizerObjectTypesProvider.add({
    type: 'audio-event-detection',
    $loader: ['VisualizerObjectAudioEventDetectionTypeLoader', function (VisualizerObjectAudioEventDetectionTypeLoader) {
      return VisualizerObjectAudioEventDetectionTypeLoader;
    }]
  });
}]).service('VisualizerObjectAudioEventDetectionTypeLoader', ["$q", "AudioEventDetectionService", "plotlyPlotMaker", "a2UrlUpdate", function ($q, AudioEventDetectionService, plotlyPlotMaker, a2UrlUpdate) {
  var aggregates;
  var statisticsInfo;
  var getParameters = $q.resolve().then(function () {
    return $q.all([AudioEventDetectionService.getDataAggregatesList().then(function (_aggregates) {
      aggregates = _aggregates;
    }), AudioEventDetectionService.getDataStatisticsList().then(function (_statistics) {
      statisticsInfo = _statistics.reduce(function (_, $) {
        return _[$.statistic] = $, _;
      }, {});
    })]);
  });

  var AudioEventDetection = function (data) {
    this.update(data).then(function () {
      return getParameters;
    }.bind(this)).then(function () {
      return this.selectData({
        x: statisticsInfo.tod,
        y: statisticsInfo.y_max,
        z: aggregates.reduce(function (_, $) {
          return $.statistic == 'count' ? $ : _;
        }, null)
      });
    }.bind(this));
  };

  AudioEventDetection.fetch = function (visobject) {
    var d = $q.defer();
    visobject = new AudioEventDetection(visobject);
    d.resolve(visobject);
    return d.promise;
  };

  AudioEventDetection.load = function (visobject, $scope) {
    return AudioEventDetection.fetch(visobject);
  };

  AudioEventDetection.getCaptionFor = function (visobject) {
    return visobject.name;
  };

  AudioEventDetection.prototype = {
    type: "audio-event-detection",
    layout: 'plotted',
    zoomable: false,
    update: function (data) {
      console.log("AED data : ", data);

      for (var i in data) {
        this[i] = data[i];
      }

      this.plot = {
        layout: {
          title: data.name
        },
        data: []
      };

      if (data.statistics.indexOf('todsec') == -1) {
        data.statistics.push('todsec', 'todsecspan', 'freqspan');
      }

      return getParameters.then(function () {
        var statistics = data.statistics.reduce(function (_, $) {
          return statisticsInfo[$] && _.push(statisticsInfo[$]), _;
        }, []);
        this.data_selection = {
          x: statistics,
          y: statistics,
          z: aggregates,
          current: {
            x: statisticsInfo.tod,
            y: statisticsInfo.y_max,
            z: aggregates.reduce(function (_, $) {
              return $.statistic == 'count' ? $ : _;
            }, null)
          }
        };
      }.bind(this));
    },
    selectData: function (selection) {
      this.data_selection.current = angular.extend({}, this.data_selection.current, selection);
      var x = this.data_selection.current.x,
          y = this.data_selection.current.y,
          z = this.data_selection.current.z;
      console.log("this.data_selection.current", this.data_selection.current);
      return AudioEventDetectionService.getDataFor(this.id, x, y, z).then(function (data) {
        var plot = x == y ? plotlyPlotMaker.makeBarPlot(x, z, data, this.name) : plotlyPlotMaker.makeHeatmapPlot(x, y, z, data, this.name);
        this.plot.data = [plot.data];
        this.plot.layout = plot.layout;
      }.bind(this));
    },
    savePlot: function () {
      var x = this.data_selection.current.x,
          y = this.data_selection.current.y,
          z = this.data_selection.current.z;
      return AudioEventDetectionService.savePlotFor(this.id, x, y, z).then(function (data) {
        a2UrlUpdate.update(data.url);
      });
    },
    getCaption: function () {
      return AudioEventDetection.getCaptionFor(this);
    }
  };
  return AudioEventDetection;
}]);
angular.module('a2.visobjects.common', []).provider('VisualizerObjectTypes', function () {
  var types = {};
  var defers = {};
  return {
    add: function (typeDef) {
      types[typeDef.type] = angular.extend(types[typeDef.type] || {}, typeDef);
    },
    $get: ["$injector", function ($injector) {
      return {
        types: types,
        getLoader: function (type) {
          if (!types[type]) {
            throw new Error("Visualizer Object Type '" + type + "' not found");
          }

          return $injector.invoke(types[type].$loader);
        }
      };
    }]
  };
});
angular.module('a2.visobjects.recording', ['a2.services', 'a2.visobjects.common']).config(["VisualizerObjectTypesProvider", function (VisualizerObjectTypesProvider) {
  VisualizerObjectTypesProvider.add({
    type: 'recording',
    $loader: ['VisualizerObjectRecordingTypeLoader', function (VisualizerObjectRecordingTypeLoader) {
      return VisualizerObjectRecordingTypeLoader;
    }]
  });
}]).service('VisualizerObjectRecordingTypeLoader', ["$q", "Project", "$localStorage", function ($q, Project, $localStorage) {
  var khz_format = function (v) {
    return v / 1000 | 0;
  };

  var getSelectedFrequencyCache = function () {
    try {
      return JSON.parse($localStorage.getItem('visuilizer.frequencies.cache')) || {
        originalScale: true
      };
    } catch (e) {
      return {
        originalScale: true
      };
    }
  };

  var scaleCache = getSelectedFrequencyCache();

  var recording = function (data, extra) {
    for (var i in data) {
      this[i] = data[i];
    }

    this.sampling_rate = this.sample_rate;
    this.extra = extra;
    this.max_freq = this.sampling_rate / 2;
    this.span = scaleCache && scaleCache.originalScale ? this.max_freq : this.max_freq > 24000 ? this.max_freq : 24000;

    if (!data) {
      this.span = 44100 / 2;
      this.duration = 60;
    }

    this.domain = {
      x: {
        from: 0,
        to: this.duration,
        span: this.duration,
        unit: 'Time ( s )',
        ticks: 60
      },
      y: {
        from: 0,
        to: this.span,
        span: this.span,
        unit: 'Frequency ( kHz )',
        tick_format: khz_format
      }
    };

    if (!this.tiles) {
      this.isDisabled = true;
      return;
    } // set it to the scope


    this.tiles.set.forEach(function (tile) {
      if (!!data.legacy) {
        tile.src = "/legacy-api/project/" + Project.getUrl() + "/recordings/tiles/" + this.id + "/" + tile.i + "/" + tile.j;
      } else {
        var streamId = data.uri.split('/')[3];
        const datetime = data.datetime_utc ? data.datetime_utc : data.datetime;
        var start = new Date(new Date(datetime).valueOf() + Math.round(tile.s * 1000)).toISOString();
        var end = new Date(new Date(datetime).valueOf() + Math.round((tile.s + tile.ds) * 1000)).toISOString();
        tile.src = '/legacy-api/ingest/recordings/' + streamId + '_t' + start.replace(/-|:|\./g, '') + '.' + end.replace(/-|:|\./g, '') + '_z95_wdolph_g1_fspec_mtrue_d1023.255.png';
      }
    }.bind(this));
  };

  recording.layers = [];

  recording.fetch = function (visobject) {
    var d = $q.defer();
    Project.getRecordingInfo(visobject.id, function (data) {
      if (data === 'Server error') {
        visobject.isDisabled = true;
        data = {};
      }

      visobject = new recording(data, visobject.extra);
      d.resolve(visobject);
    });
    return d.promise;
  };

  recording.load = function (visobject, $scope) {
    return recording.fetch(visobject).then(function (visobject) {
      if (visobject.audioUrl) {
        $scope.audio_player.load(visobject.audioUrl);
      }

      return visobject;
    });
  };

  recording.getCaptionFor = function (visobject) {
    return visobject.file;
  };

  recording.prototype = {
    type: "recording",
    zoomable: true,
    getCaption: function () {
      return recording.getCaptionFor(this);
    }
  };
  return recording;
}]);
angular.module('a2.visobjects.soundscape', ['a2.services', 'a2.visobjects.common']).config(["VisualizerObjectTypesProvider", function (VisualizerObjectTypesProvider) {
  VisualizerObjectTypesProvider.add({
    type: 'soundscape',
    $loader: ['VisualizerObjectSoundscapeTypeLoader', function (VisualizerObjectSoundscapeTypeLoader) {
      return VisualizerObjectSoundscapeTypeLoader;
    }]
  });
}]).service('VisualizerObjectSoundscapeTypeLoader', ["$q", "Project", function ($q, Project) {
  var khz_format = function (v) {
    return v / 1000 | 0;
  };

  var khz_unit_fmt = function (v) {
    return Math.floor(v / 10.0) / 100.0 + " kHz";
  };

  var aggregations = {
    'time_of_day': {
      time_unit: 'Time (Hour in Day)',
      unit_fmt: function (v) {
        return (v | 0) + ":00";
      }
    },
    'day_of_month': {
      time_unit: 'Time (Day in Month)',
      unit_fmt: function (v) {
        return v | 0;
      }
    },
    'day_of_year': {
      time_unit: 'Time (Day in Year )',
      unit_fmt: function (v) {
        return v | 0;
      }
    },
    'month_in_year': {
      time_unit: 'Time (Month in Year)',
      unit_fmt: function (v) {
        return moment().localeData()._months[(v | 0) - 1];
      }
    },
    'day_of_week': {
      time_unit: 'Time (Weekday) ',
      unit_fmt: function (v) {
        return moment().localeData()._weekdays[(v | 0) - 1];
      }
    },
    'year': {
      time_unit: 'Time (Year) ',
      unit_fmt: function (v) {
        return v | 0;
      }
    },
    'unknown': {
      time_unit: 'Time',
      unit_fmt: function (v) {
        return v | 0;
      }
    }
  };

  var soundscape = function (data) {
    this.update(data);
  };

  soundscape.fetch = function (visobject) {
    var d = $q.defer();
    visobject = new soundscape(visobject);
    d.resolve(visobject);
    return d.promise;
  };

  soundscape.load = function (visobject, $scope) {
    return soundscape.fetch(visobject);
  };

  soundscape.getCaptionFor = function (visobject) {
    var agg = {
      'time_of_day': 'Time of day',
      'day_of_month': 'Day of Month',
      'day_of_year': 'Day of Year',
      'month_in_year': 'Month in year',
      'day_of_week': 'Day of week',
      'year': 'Year '
    };
    return visobject.name + " (" + agg[visobject.aggregation] + ")";
  };

  soundscape.prototype = {
    type: "soundscape",
    zoomable: true,
    update: function (data) {
      for (var i in data) {
        this[i] = data[i];
      }

      var t0 = this.min_t,
          t1 = this.max_t;
      var f0 = this.min_f,
          f1 = this.max_f;
      var v0 = this.min_value,
          v1 = this.visual_max_value || this.max_value;

      if (this.normalized) {
        v0 = 0;
        v1 = 100;
      }

      var dt = t1 - t0 + 1,
          df = f1 - f0,
          dv = v1 - v0;
      var aggregation = aggregations[this.aggregation] || aggregations.unknown;
      var time_unit = aggregation.time_unit; // setup the domains

      this.domain = {
        x: {
          // from : t0, to : t1 + 1, span : dt + 1, ticks : dt + 1,
          from: t0,
          to: t1,
          span: dt,
          ticks: dt,
          ordinal: true,
          unit_interval: 1,
          unit_format: aggregation.unit_fmt,
          unit: time_unit || 'Time ( s )'
        },
        y: {
          from: f0,
          to: f1,
          span: df,
          unit: 'Frequency ( kHz )',
          unit_interval: this.bin_size,
          unit_format: khz_unit_fmt,
          tick_format: khz_format
        },
        legend: {
          from: v0,
          to: v1,
          span: dv,
          ticks: Math.max(2, Math.min(dv | 0, 10)),
          unit: 'Count',
          src: '/images/palettes/' + this.visual_palette + '.png'
        }
      };

      if (this.normalized) {
        this.domain.legend.tick_format = function (v) {
          return v + '%';
        };
      } // set it to the scope


      this.tiles = {
        x: 1,
        y: 1,
        set: [{
          i: 0,
          j: 0,
          s: 0,
          hz: f1,
          ds: dt,
          dhz: df,
          src: this.thumbnail,
          crisp: true
        }]
      };
      this.legend = {
        min: 0,
        max: 255
      };
    },
    getCaption: function () {
      return soundscape.getCaptionFor(this);
    }
  };
  return soundscape;
}]);
angular.module('a2.visobjects', ['a2.visobjects.common', 'a2.visobjects.recording', 'a2.visobjects.soundscape', 'a2.visobjects.audio-event-detection']);
angular.module('a2.analysis.random-forest-models.classification', ['ui.bootstrap', 'a2.services', 'a2.permissions', 'humane', 'c3-charts']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('analysis.random-forest-models.classification', {
    url: '/classification',
    controller: 'ClassificationCtrl',
    templateUrl: '/app/analysis/random-forest-models/classification/list.html'
  });
}]).controller('ClassificationCtrl', ["$scope", "$modal", "$filter", "Project", "ngTableParams", "JobsData", "a2Playlists", "notify", "$location", "a2Classi", "a2UserPermit", function ($scope, $modal, $filter, Project, ngTableParams, JobsData, a2Playlists, notify, $location, a2Classi, a2UserPermit) {
  var initTable = function (p, c, s, f, t) {
    var sortBy = {};
    var acsDesc = 'desc';

    if (s[0] == '+') {
      acsDesc = 'asc';
    }

    sortBy[s.substring(1)] = acsDesc;
    var tableConfig = {
      page: p,
      count: c,
      sorting: sortBy,
      filter: f
    };
    $scope.tableParams = new ngTableParams(tableConfig, {
      total: t,
      getData: function ($defer, params) {
        $scope.infopanedata = "";
        var filteredData = params.filter() ? $filter('filter')($scope.classificationsOriginal, params.filter()) : $scope.classificationsOriginal;
        var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : $scope.classificationsOriginal;
        params.total(orderedData.length);
        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

        if (orderedData.length < 1) {
          $scope.infopanedata = "No classifications found.";
        }

        $scope.classificationsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
        a2Classi.saveState({
          'data': $scope.classificationsOriginal,
          'filtered': $scope.classificationsData,
          'f': params.filter(),
          'o': params.orderBy(),
          'p': params.page(),
          'c': params.count(),
          't': orderedData.length
        });
      }
    });
  };

  $scope.updateFlags = function () {
    $scope.successInfo = "";
    $scope.showSuccess = false;
    $scope.errorInfo = "";
    $scope.showError = false;
    $scope.infoInfo = "";
    $scope.showInfo = false;
    $scope.loading = false;
  };

  $scope.capitalize = function (row) {
    return row.length ? row[0].toUpperCase() + row.slice(1) : row;
  };

  $scope.loadClassifications = function () {
    a2Classi.list(function (data) {
      $scope.classificationsOriginal = data;
      data.forEach(function (row) {
        row.muser = $scope.capitalize(row.firstname) + " " + $scope.capitalize(row.lastname);
      });
      $scope.classificationsData = data;
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
      $scope.infopanedata = "";

      if (data.length > 0) {
        if (!$scope.tableParams) {
          initTable(1, 10, "+cname", {}, data.length);
        } else {
          $scope.tableParams.reload();
        }
      } else {
        $scope.infopanedata = "No classifications found.";
      }
    });
  };

  $scope.showClassificationDetails = function (classi) {
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.loading = true;
    var data = {
      id: classi.job_id,
      name: classi.cname,
      modelId: classi.model_id,
      playlist: {
        name: classi.playlist_name,
        id: classi.playlist_id
      }
    };
    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/random-forest-models/classification/classinfo.html',
      controller: 'ClassiDetailsInstanceCtrl',
      windowClass: 'details-modal-window',
      backdrop: 'static',
      resolve: {
        ClassiInfo: function () {
          return {
            data: data,
            project: $scope.projectData
          };
        }
      }
    });
    modalInstance.opened.then(function () {
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
    });
  };

  $scope.createNewClassification = function () {
    if (!a2UserPermit.can('manage models and classification')) {
      notify.error('You do not have permission to create classifications');
      return;
    }

    $scope.loading = true;
    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/random-forest-models/classification/createnewclassification.html',
      controller: 'CreateNewClassificationInstanceCtrl',
      resolve: {
        data: ["$q", function ($q) {
          var d = $q.defer();
          Project.getModels(function (err, data) {
            if (err) {
              console.error(err);
            }

            d.resolve(data || []);
          });
          return d.promise;
        }],
        playlists: ["$q", function ($q) {
          var d = $q.defer();
          a2Playlists.getList().then(function (data) {
            d.resolve(data || []);
          });
          return d.promise;
        }],
        projectData: function () {
          return $scope.projectData;
        }
      }
    });
    modalInstance.opened.then(function () {
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
    });
    modalInstance.result.then(function (result) {
      data = result;

      if (data.ok) {
        JobsData.updateJobs();
        notify.log("Your new classification is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
      }

      if (data.error) {
        notify.error("Error: " + data.error);
      }

      if (data.url) {
        $location.path(data.url);
      }
    });
  };

  $scope.deleteClassification = function (id, name) {
    if (!a2UserPermit.can('manage models and classification')) {
      notify.error('You do not have permission to delete classifications');
      return;
    }

    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.loading = true;
    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/random-forest-models/classification/deleteclassification.html',
      controller: 'DeleteClassificationInstanceCtrl',
      resolve: {
        name: function () {
          return name;
        },
        id: function () {
          return id;
        },
        projectData: function () {
          return $scope.projectData;
        }
      }
    });
    modalInstance.opened.then(function () {
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
    });
    modalInstance.result.then(function (ret) {
      if (ret.err) {
        notify.error("Error: " + ret.err);
      } else {
        var index = -1;
        var modArr = angular.copy($scope.classificationsOriginal);

        for (var i = 0; i < modArr.length; i++) {
          if (modArr[i].job_id === id) {
            index = i;
            break;
          }
        }

        if (index > -1) {
          $scope.classificationsOriginal.splice(index, 1);
          $scope.tableParams.reload();
          notify.log("Classification deleted successfully");
        }
      }
    });
  };

  $scope.loading = true;
  $scope.infoInfo = "Loading...";
  $scope.showInfo = true;
  Project.getInfo(function (data) {
    $scope.projectData = data;
  });
  var stateData = a2Classi.getState();

  if (stateData === null) {
    $scope.loadClassifications();
  } else {
    if (stateData.data.length > 0) {
      $scope.classificationsData = stateData.filtered;
      $scope.classificationsOriginal = stateData.data;
      initTable(stateData.p, stateData.c, stateData.o[0], stateData.f, stateData.filtered.length);
    } else {
      $scope.infopanedata = "No models found.";
    }

    $scope.infoInfo = "";
    $scope.showInfo = false;
    $scope.loading = false;
  }
}]).controller('DeleteClassificationInstanceCtrl', ["$scope", "$modalInstance", "a2Classi", "name", "id", "projectData", function ($scope, $modalInstance, a2Classi, name, id, projectData) {
  $scope.name = name;
  $scope.id = id;
  $scope.deletingloader = false;
  $scope.projectData = projectData;
  var url = $scope.projectData.url;

  $scope.ok = function () {
    $scope.deletingloader = true;
    a2Classi.delete(id, function (data) {
      $modalInstance.close(data);
    });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]).controller('ClassiDetailsInstanceCtrl', ["$scope", "$modalInstance", "a2Classi", "a2Models", "notify", "a2UserPermit", "ClassiInfo", function ($scope, $modalInstance, a2Classi, a2Models, notify, a2UserPermit, ClassiInfo) {
  var loadClassifiedRec = function () {
    a2Classi.getResultDetails($scope.classiData.id, $scope.currentPage * $scope.maxPerPage, $scope.maxPerPage, function (dataRec) {
      a2Classi.getRecVector($scope.classiData.id, dataRec[0].recording_id).success(function (data) {
        var maxVal = Math.max.apply(null, data.vector);

        if (typeof $scope.th === 'number') {
          $scope.htresDeci = maxVal < $scope.th ? 'no' : 'yes';
        }

        $scope.recVect = data.vector;
        $scope.recs = dataRec;
        $scope.minv = dataRec[0].stats.minv;
        $scope.maxv = dataRec[0].stats.maxv;
        $scope.maxvRounded = Math.round($scope.maxv * 1000) / 1000;
      });
    });
  };

  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.next = function () {
    $scope.currentPage = $scope.currentPage + 1;

    if ($scope.currentPage * $scope.maxPerPage >= $scope.classiData.total) {
      $scope.currentPage = $scope.currentPage - 1;
    } else {
      loadClassifiedRec();
    }
  };

  $scope.prev = function () {
    $scope.currentPage = $scope.currentPage - 1;

    if ($scope.currentPage < 0) {
      $scope.currentPage = 0;
    } else {
      loadClassifiedRec();
    }
  };

  $scope.gotoc = function (where) {
    if (where == 'first') {
      $scope.currentPage = 0;
    }

    if (where == 'last') {
      $scope.currentPage = Math.ceil($scope.classiData.total / $scope.maxPerPage) - 1;
    }

    loadClassifiedRec();
  };

  $scope.toggleRecDetails = function () {
    $scope.showMore = !$scope.showMore;

    if ($scope.showMore && !$scope.recs) {
      loadClassifiedRec();
    }
  };

  $scope.loading = true;
  $scope.htresDeci = '-';
  $scope.classiData = ClassiInfo.data;
  $scope.project = ClassiInfo.project;
  $scope.showMore = false;
  $scope.currentPage = 0;
  $scope.maxPerPage = 1;
  $scope.csvUrl = "/legacy-api/project/" + $scope.project.url + "/classifications/csv/" + $scope.classiData.id;
  $scope.showDownload = a2UserPermit.can('manage models and classification');
  console.table($scope.classiData);
  a2Classi.getDetails($scope.classiData.id, function (data) {
    if (!data) {
      $modalInstance.close();
      notify.log("No details available for this classification");
      return;
    }

    angular.extend($scope.classiData, data);
    $scope.totalRecs = Math.ceil($scope.classiData.total / $scope.maxPerPage);
    console.log($scope.classiData);
    $scope.results = [['absent', $scope.classiData.total - $scope.classiData.present], ['present', $scope.classiData.present], ['skipped', $scope.classiData.errCount]];
    a2Models.findById($scope.classiData.modelId).success(function (modelInfo) {
      console.log(modelInfo);
      $scope.model = modelInfo;
      $scope.loading = false;
    }).error(function (err) {
      $scope.loading = false;
    });
  });
}]).controller('CreateNewClassificationInstanceCtrl', ["$scope", "$modalInstance", "a2Classi", "data", "projectData", "playlists", function ($scope, $modalInstance, a2Classi, data, projectData, playlists) {
  $scope.data = data;
  $scope.projectData = projectData;
  $scope.recselected = '';
  $scope.showselection = false;
  $scope.playlists = playlists;
  $scope.nameMsg = '';
  $scope.datas = {
    name: '',
    classifier: '',
    playlist: ''
  };
  $scope.$watch('recselected', function () {
    if ($scope.recselected === 'selected') {
      $scope.showselection = true;
    } else {
      $scope.showselection = false;
    }
  });

  $scope.ok = function () {
    $scope.nameMsg = '';
    var url = $scope.projectData.url;
    $scope.all = 0;
    $scope.selectedSites = []; // NOTE temporary block disabled model types

    if (!$scope.datas.classifier.enabled) return;
    var classiData = {
      n: $scope.datas.name,
      c: $scope.datas.classifier.model_id,
      a: $scope.all,
      s: $scope.selectedSites.join(),
      p: $scope.datas.playlist
    };
    a2Classi.create(classiData, function (data) {
      if (data.name) {
        $scope.nameMsg = 'Name exists';
      } else {
        $modalInstance.close(data);
      }
    });
  };

  $scope.buttonEnable = function () {
    /*
        var flag = false;
        if ($scope.recselected === 'all')
            flag = true;
        else
        {
            var numberOfChecked = $('input:checkbox:checked').length;
            if (numberOfChecked>0)
            {
                flag = true;
            }
         }
    */
    return !(typeof $scope.datas.playlist !== 'string' && $scope.datas.name.length && typeof $scope.datas.classifier !== 'string');
  };

  $scope.cancel = function (url) {
    $modalInstance.close({
      url: url
    });
  };
}]).directive('a2Vectorchart', function () {
  return {
    restrict: 'E',
    scope: {
      vectorData: '=',
      minvect: '=',
      maxvect: '='
    },
    templateUrl: '/app/analysis/random-forest-models/classification/vectorchart.html',
    controller: ["$scope", function ($scope) {
      $scope.loadingflag = true;

      $scope.drawVector = function () {
        if (!$scope.vectorData) return;
        $scope.loadingflag = true;
        var canvas = $scope.canvas;
        var vector = $scope.vectorData;
        var height = 50;
        var width = $scope.width;
        var xStep;

        if (width >= vector.length) {
          canvas.width = width;
          xStep = width / vector.length;
        } else {
          canvas.width = vector.length;
          xStep = 1;
        }

        canvas.height = height;
        ctx = canvas.getContext('2d');
        ctx.beginPath();
        var i = 0;
        ctx.moveTo(i * xStep, height * (1 - (vector[i] - $scope.minvect) / ($scope.maxvect - $scope.minvect)));

        while (i < vector.length) {
          i++;
          ctx.lineTo(i * xStep, height * (1 - (vector[i] - $scope.minvect) / ($scope.maxvect - $scope.minvect)));
        }

        ctx.strokeStyle = '#000';
        ctx.stroke();

        if ($scope.minvect < -0.09) {
          //code
          ctx.beginPath();
          i = 0;
          ctx.moveTo(i * xStep, height * (1 - (0 - $scope.minvect) / ($scope.maxvect - $scope.minvect)));

          while (i < vector.length) {
            i++;
            ctx.lineTo(i * xStep, height * (1 - (0 - $scope.minvect) / ($scope.maxvect - $scope.minvect)));
          }

          ctx.strokeStyle = '#aa0000';
          ctx.stroke();
        }

        $scope.loadingflag = false;
      };

      $scope.$watch('vectorData', function () {
        $scope.drawVector();
      });
    }],
    link: function (scope, element) {
      scope.canvas = element.children()[0];
      scope.width = parseInt(element.css('width'));
    }
  };
});
angular.module('a2.analysis.random-forest-models.models', ['a2.services', 'a2.permissions', 'a2.utils', 'ui.bootstrap', 'ui.select', 'ngSanitize', 'ngTable', 'ngCsv', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('analysis.random-forest-models.models', {
    url: '/models?newJob',
    controller: 'ModelsCtrl',
    templateUrl: '/app/analysis/random-forest-models/models/list.html'
  }).state('analysis.modeldetails', {
    url: '/model/:modelId',
    controller: 'ModelDetailsCtrl',
    templateUrl: '/app/analysis/random-forest-models/models/modelinfo.html'
  });
}]).controller('ModelsCtrl', ["$scope", "$modal", "$filter", "ngTableParams", "Project", "a2Models", "JobsData", "$location", "notify", "a2UserPermit", "$state", function ($scope, $modal, $filter, ngTableParams, Project, a2Models, JobsData, $location, notify, a2UserPermit, $state) {
  $scope.infoInfo = "Loading...";
  $scope.showInfo = true;
  $scope.loading = true;

  $scope.updateFlags = function () {
    $scope.successInfo = "";
    $scope.showSuccess = false;
    $scope.errorInfo = "";
    $scope.showError = false;
    $scope.infoInfo = "";
    $scope.showInfo = false;
    $scope.loading = false;
  };

  Project.getInfo(function (data) {
    $scope.projectData = data;
  });
  var p = $state.params;
  var isNewJob = p && p.newJob !== undefined;

  var initTable = function (p, c, s, f, t) {
    var sortBy = {};
    var acsDesc = 'desc';

    if (s[0] == '+') {
      acsDesc = 'asc';
    }

    sortBy[s.substring(1)] = acsDesc;
    $scope.tableParams = new ngTableParams({
      page: p,
      count: c,
      sorting: sortBy,
      filter: f
    }, {
      total: t,
      getData: function ($defer, params) {
        $scope.infopanedata = "";
        var filteredData = params.filter() ? $filter('filter')($scope.modelsDataOrig, params.filter()) : $scope.modelsDataOrig;
        var orderedData = params.sorting() ? $filter('orderBy')(filteredData, params.orderBy()) : filteredData;
        params.total(orderedData.length);
        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));

        if (orderedData.length < 1) {
          $scope.infopanedata = "No models found.";
        }

        $scope.modelsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
        a2Models.saveState({
          data: $scope.modelsDataOrig,
          filtered: $scope.modelsData,
          f: params.filter(),
          o: params.orderBy(),
          p: params.page(),
          c: params.count(),
          t: orderedData.length
        });
      }
    });
  };

  $scope.loadModels = function () {
    a2Models.list(function (data) {
      $scope.modelsData = data;
      $scope.modelsDataOrig = data;
      $scope.showInfo = false;
      $scope.loading = false;

      if (data.length > 0) {
        if (!$scope.tableParams) {
          initTable(1, 10, "+mname", {}, data.length);
        } else {
          $scope.tableParams.reload();
        }
      } else {
        $scope.infopanedata = "No models found.";
      }
    });
  };

  var stateData = a2Models.getState();

  if (stateData === null) {
    $scope.loadModels();
  } else {
    if (stateData.data.length > 0) {
      $scope.modelsData = stateData.filtered;
      $scope.modelsDataOrig = stateData.data;
      initTable(stateData.p, stateData.c, stateData.o[0], stateData.f, stateData.filtered.length);
    } else {
      $scope.infopanedata = "No models found.";
    }

    $scope.infoInfo = "";
    $scope.showInfo = false;
    $scope.loading = false;
  }

  $scope.deleteModel = function (model_id, model_name) {
    if (!a2UserPermit.can('manage models and classification')) {
      notify.error('You do not have permission to delete models');
      return;
    }

    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.loading = true;
    var modalInstance = $modal.open({
      templateUrl: '/app/analysis/random-forest-models/models/deletemodel.html',
      controller: 'DeleteModelInstanceCtrl',
      resolve: {
        model_name: function () {
          return model_name;
        },
        model_id: function () {
          return model_id;
        },
        projectData: function () {
          return $scope.projectData;
        }
      }
    });
    modalInstance.opened.then(function () {
      $scope.infoInfo = "";
      $scope.showInfo = false;
      $scope.loading = false;
    });
    modalInstance.result.then(function (ret) {
      if (ret.error) {
        notify.error("Error: " + ret.error);
      } else {
        var index = -1;
        var modArr = angular.copy($scope.modelsDataOrig);

        for (var i = 0; i < modArr.length; i++) {
          if (modArr[i].model_id === model_id) {
            index = i;
            break;
          }
        }

        if (index > -1) {
          $scope.modelsDataOrig.splice(index, 1);
          $scope.tableParams.reload();
          notify.log("Model deleted successfully");
        }
      }
    });
  };

  $scope.model_id = null;
  $scope.validationdata = null;

  $scope.newModel = function () {
    if (!a2UserPermit.can('manage models and classification')) {
      notify.error('You do not have permission to create models');
      return;
    }

    $scope.infoInfo = "Loading...";
    $scope.showInfo = true;
    $scope.loading = true; // var url = $scope.projectData.url;

    a2Models.getFormInfo(function (data) {
      var modalInstance = $modal.open({
        templateUrl: '/app/analysis/random-forest-models/models/newmodel.html',
        controller: 'NewModelInstanceCtrl',
        resolve: {
          projectData: function () {
            return $scope.projectData;
          },
          types: function () {
            var typesEnable = data.types.filter(function (type) {
              return type.enabled;
            });
            return typesEnable;
          },
          trainings: function () {
            return data.trainings;
          }
        }
      });
      modalInstance.opened.then(function () {
        $scope.infoInfo = "";
        $scope.showInfo = false;
        $scope.loading = false;
      });
      modalInstance.result.then(function (result) {
        if (result.ok) {
          JobsData.updateJobs();
          notify.log("Your new model training is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
        }

        if (result.error) {
          notify.error("Error " + result.error);
        }

        if (result.url) {
          $location.path(result.url);
        }
      });
    });
  };

  if (isNewJob) {
    $scope.newModel();
  }
}]).controller('NewModelInstanceCtrl', ["$scope", "$modalInstance", "a2Models", "Project", "projectData", "types", "trainings", "notify", "$http", function ($scope, $modalInstance, a2Models, Project, projectData, types, trainings, notify, $http) {
  $scope.types = types;
  $scope.projectData = projectData;
  $scope.trainings = trainings;
  $scope.nameMsg = '';
  $scope.data = {
    training: '',
    classifier: '',
    name: '',
    totalValidations: 'Retrieving...',
    presentValidations: '-',
    absentsValidations: '-',
    usePresentTraining: '',
    useNotPresentTraining: '',
    usePresentValidation: -1,
    useNotPresentValidation: -1
  };
  $http.get('/legacy-api/jobs/types').success(function (jobTypes) {
    var training = jobTypes.filter(function (type) {
      return type.name === "Model training";
    });
    if (!training.length) return console.error('training job info not found');
    $scope.jobDisabled = !training[0].enabled;
  });
  $scope.totalPresentValidation = 0;
  $scope.$watch('data.usePresentTraining', function () {
    var val = $scope.data.presentValidations - $scope.data.usePresentTraining;

    if (val > -1) {
      $scope.data.usePresentValidation = val;
    } else {
      $scope.data.usePresentValidation = 0;
    }

    if ($scope.data.usePresentTraining > $scope.data.presentValidations) {
      $scope.data.usePresentTraining = $scope.data.presentValidations;
    }

    $scope.totalPresentValidation = $scope.data.usePresentValidation;
  });
  $scope.totalNotPresentValidation = 0;
  $scope.$watch('data.useNotPresentTraining', function () {
    var val = $scope.data.absentsValidations - $scope.data.useNotPresentTraining;

    if (val > -1) {
      $scope.data.useNotPresentValidation = val;
    } else $scope.data.useNotPresentValidation = 0;

    if ($scope.data.useNotPresentTraining > $scope.data.absentsValidations) $scope.data.useNotPresentTraining = $scope.data.absentsValidations;
    $scope.totalNotPresentValidation = $scope.data.useNotPresentValidation;
  });
  $scope.$watch('data.usePresentValidation', function () {
    if ($scope.data.usePresentValidation > $scope.totalPresentValidation) {
      $scope.data.usePresentValidation = $scope.totalPresentValidation;
    }
  });
  $scope.$watch('data.useNotPresentValidation', function () {
    if ($scope.data.useNotPresentValidation > $scope.totalNotPresentValidation) {
      $scope.data.useNotPresentValidation = $scope.totalNotPresentValidation;
    }
  });
  $scope.$watch('data.training', function () {
    if ($scope.data.training !== '') {
      Project.validationBySpeciesSong($scope.data.training.species_id, $scope.data.training.songtype_id, function (data) {
        $scope.data.totalValidations = data.total;
        $scope.data.presentValidations = data.present;
        $scope.data.absentsValidations = data.absent;
      });
    }
  });

  $scope.disableCreateButton = function () {
    return !($scope.trainings.length && $scope.data.name.length && $scope.totalNotPresentValidation > 0 && $scope.totalPresentValidation > 0 && $scope.data.usePresentTraining > 0 && $scope.data.useNotPresentTraining > 0 && $scope.data.usePresentValidation > 0 && $scope.data.useNotPresentValidation > 0 && typeof $scope.data.training !== 'string' && typeof $scope.data.classifier !== 'string' && !$scope.jobDisabled);
  };

  $scope.cancel = function (url) {
    $modalInstance.close({
      url: url
    });
  };

  $scope.ok = function () {
    $scope.nameMsg = '';
    a2Models.create({
      n: $scope.data.name,
      t: $scope.data.training.training_set_id,
      c: $scope.data.classifier.model_type_id,
      tp: parseInt($scope.data.usePresentTraining),
      tn: parseInt($scope.data.useNotPresentTraining),
      vp: parseInt($scope.data.usePresentValidation),
      vn: parseInt($scope.data.useNotPresentValidation)
    }).success(function (data) {
      if (data.name) {
        $scope.nameMsg = 'Name exists';
      } else {
        $modalInstance.close(data);
      }
    }).error(function () {
      $modalInstance.close({
        err: "Could not create job"
      });
    });
  };
}]).controller('DeleteModelInstanceCtrl', ["$scope", "$modalInstance", "a2Models", "model_name", "model_id", "projectData", "notify", function ($scope, $modalInstance, a2Models, model_name, model_id, projectData, notify) {
  $scope.model_name = model_name;
  $scope.model_id = model_id;
  $scope.projectData = projectData;
  var url = $scope.projectData.url;

  $scope.ok = function () {
    a2Models.delete(model_id, function (data) {
      $modalInstance.close(data);
    });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]).controller('NewClassificationInstanceCtrl', ["$scope", "$modalInstance", "model_name", "model_id", function ($scope, $modalInstance, model_name, model_id) {
  $scope.model_name = model_name;
  $scope.model_id = model_id;

  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
}]).controller('ModelDetailsCtrl', ["$scope", "a2Models", "$stateParams", "$location", "Project", "a2Classi", "notify", "$window", "a2UserPermit", function ($scope, a2Models, $stateParams, $location, Project, a2Classi, notify, $window, a2UserPermit) {
  var scopeExited = false;
  $scope.$on('$destroy', function (argument) {
    scopeExited = true;
    a2Models.modelState(false);
  });
  /*
      method recursively get validations vectors and then call waitinFunction()
   */

  var getVectors = function (index) {
    if (scopeExited) return;
    if (index >= $scope.validations.length) return $scope.waitinFunction();
    var currRec = $scope.validations[index];
    currRec.date = $window.moment(currRec.date, 'MM-DD-YYYY HH:mm');
    a2Models.getRecVector($scope.model.id, currRec.id).success(function (data) {
      if (!(data.err && data.err == "vector-not-found")) {
        var vector = data.vector;
        var vmax = Math.max.apply(null, vector);
        var vmin = Math.min.apply(null, vector);
        currRec.vmax = vmax;
        currRec.vector = vector;
        $scope.allMax.push(vmax);
        $scope.allMin.push(vmin);

        if (currRec.presence == 'no') {
          if ($scope.vectorNoMax < vmax) {
            $scope.vectorNoMax = vmax;
          }
        } else if (currRec.presence == 'yes') {
          $scope.allYesMax.push(vmax);
        }
      }

      getVectors(++index);
    });
  };

  var loadingMsgs = ['', 'Loading validations', 'Loading vectors'];
  $scope.loading = true;
  $scope.showValidationsTable = true;
  $scope.allYesMax = [];
  $scope.allMax = [];
  $scope.allMin = [];
  $scope.vectorNoMax = -1;
  $scope.loadingValidations = true;
  $scope.showModelValidations = true;
  $scope.messageSaved = '';
  a2Models.modelState(true);
  Project.getInfo(function (data) {
    $scope.project_id = data.project_id;
  });
  a2Models.findById($stateParams.modelId).success(function (model) {
    $scope.model = model;
    $scope.loading = null;
  }).error(function (data, status) {
    if (status == 404) {
      $scope.notFound = true;
    } else {
      notify.serverError();
    }
  });
  a2Models.getValidationResults($stateParams.modelId, function (data) {
    if (data.err || !data.validations.length) {
      $scope.showModelValidations = false;
      $scope.loadingValidations = false;
      return;
    }

    $scope.validations = data.validations;
    getVectors(0);
  });

  $scope.waitinFunction = function () {
    $scope.loading = null;

    if (!$scope.allYesMax.length) {
      $scope.showModelValidations = false;
      $scope.loadingValidations = false;
    }

    $scope.allYesMax = $scope.allYesMax.sort();
    var index = 0;

    for (var j = 0; j < $scope.allYesMax.length; j++) {
      if ($scope.allYesMax[j] >= $scope.vectorNoMax) {
        index = j;
      }
    } // NOTE this value is received from the server and overwritten here, maybe this value can be saved


    $scope.model.maxv = Math.max.apply(null, $scope.allMax);
    $scope.model.minv = Math.min.apply(null, $scope.allMin);
    $scope.suggestedThreshold = Math.round($scope.allYesMax[index] * 1000000) / 1000000;

    if (typeof $scope.suggestedThreshold === undefined || isNaN($scope.suggestedThreshold)) {
      $scope.suggestedThreshold = Math.round($scope.allYesMax[0] * 1000000) / 1000000;
    }

    if (typeof $scope.suggestedThreshold === undefined || isNaN($scope.suggestedThreshold)) {
      $scope.showModelValidations = false;
    } else {
      // TODO optimize this section
      var searchTh = $scope.suggestedThreshold;
      var thresholdObject = [];
      var precisionObject = [];
      var accuracyObject = [];
      var sensitivityObject = [];
      var specificityObject = [];
      var sumObject = [];
      var tries = 0;
      var i, ii, jj;

      while (searchTh > 0.01 && tries < 15) {
        for (jj = 0; jj < $scope.validations.length; jj++) {
          $scope.validations[jj].threshold = $scope.validations[jj].vmax > searchTh ? 'yes' : 'no';
        }

        $scope.computeStats();
        thresholdObject.push(searchTh);
        precisionObject.push($scope.thres.precision);
        accuracyObject.push($scope.thres.accuracy);
        sensitivityObject.push($scope.thres.sensitivity);
        specificityObject.push($scope.thres.specificity);
        sumObject.push($scope.thres.specificity + $scope.thres.sensitivity + $scope.thres.accuracy + $scope.thres.precision);
        searchTh = searchTh - 0.001;
        tries = tries + 1;
      }

      var max = sumObject[0];
      var mindex = 0;

      for (ii = 1; ii < sumObject.length; ii++) {
        if (sumObject[ii] > max) {
          max = sumObject[ii];
          mindex = ii;
        }
      }

      max = precisionObject[0];

      for (ii = 0; ii < precisionObject.length; ii++) {
        if (precisionObject[ii] >= max) {
          max = precisionObject[ii];
        }
      }

      var precisionMaxIndices = [];

      for (ii = 0; ii < precisionObject.length; ii++) {
        if (precisionObject[ii] == max) {
          precisionMaxIndices.push(ii);
        }
      }

      max = sensitivityObject[precisionMaxIndices[0]];

      for (i = 0; i < precisionMaxIndices.length; i++) {
        if (sensitivityObject[precisionMaxIndices[i]] >= max) {
          max = sensitivityObject[precisionMaxIndices[i]];
        }
      }

      var sensitivityMaxIndices = [];

      for (i = 0; i < precisionMaxIndices.length; i++) {
        if (sensitivityObject[precisionMaxIndices[i]] == max) {
          sensitivityMaxIndices.push(precisionMaxIndices[i]);
        }
      }

      max = accuracyObject[sensitivityMaxIndices[0]];

      for (i = 0; i < sensitivityMaxIndices.length; i++) {
        if (accuracyObject[sensitivityMaxIndices[i]] >= max) {
          max = accuracyObject[sensitivityMaxIndices[i]];
        }
      }

      var accuracyMaxIndices = [];

      for (i = 0; i < sensitivityMaxIndices.length; i++) {
        if (accuracyObject[sensitivityMaxIndices[i]] == max) {
          accuracyMaxIndices.push(sensitivityMaxIndices[i]);
        }
      }

      max = specificityObject[accuracyMaxIndices[0]];

      for (i = 0; i < accuracyMaxIndices.length; i++) {
        if (specificityObject[accuracyMaxIndices[i]] >= max) {
          max = specificityObject[accuracyMaxIndices[i]];
        }
      }

      var specificityMaxIndices = [];

      for (i = 0; i < accuracyMaxIndices.length; i++) {
        if (specificityObject[accuracyMaxIndices[i]] == max) {
          specificityMaxIndices.push(accuracyMaxIndices[i]);
        }
      }

      var accum = 0.0;

      for (i = 0; i < specificityMaxIndices.length; i++) {
        accum = accum + thresholdObject[specificityMaxIndices[i]];
      }

      accum = accum / specificityMaxIndices.length;
      $scope.currentThreshold = $scope.model.threshold != '-' ? $scope.model.threshold : accum;
      $scope.suggestedThreshold = Math.round(accum * 1000000) / 1000000;

      if (typeof $scope.suggestedThreshold === undefined || isNaN($scope.suggestedThreshold) || !$scope.suggestedThreshold) {
        $scope.currentThreshold = $scope.model.threshold != '-' ? $scope.model.threshold : $scope.allYesMax[0];
        $scope.suggestedThreshold = Math.round($scope.allYesMax[0] * 1000000) / 1000000;
      }

      for (jj = 0; jj < $scope.validations.length; jj++) {
        $scope.validations[jj].threshold = $scope.validations[jj].vmax > $scope.currentThreshold ? 'yes' : 'no';
      }

      $scope.computeStats();
      $scope.loadingValidations = false;
    }
  };

  $scope.computeStats = function () {
    $scope.thres = {
      tpos: '-',
      fpos: '-',
      tneg: '-',
      fneg: '-',
      accuracy: '-',
      precision: '-',
      sensitivity: '-',
      specificity: '-'
    };
    var trupositive = 0;
    var falsepositives = 0;
    var truenegatives = 0;
    var falsenegative = 0;

    for (var jj = 0; jj < $scope.validations.length; jj++) {
      if ($scope.validations[jj].presence == 'yes') {
        if ($scope.validations[jj].threshold == 'yes') {
          trupositive = trupositive + 1;
        } else {
          falsenegative = falsenegative + 1;
        }
      } else {
        if ($scope.validations[jj].threshold == 'yes') {
          falsepositives = falsepositives + 1;
        } else {
          truenegatives = truenegatives + 1;
        }
      }
    }

    $scope.thres.tpos = trupositive;
    $scope.thres.fpos = falsepositives;
    $scope.thres.tneg = truenegatives;
    $scope.thres.fneg = falsenegative;
    $scope.thres.accuracy = Math.round((trupositive + truenegatives) / (trupositive + falsepositives + truenegatives + falsenegative) * 100) / 100;

    if (trupositive + falsepositives > 0) {
      $scope.thres.precision = Math.round(trupositive / (trupositive + falsepositives) * 100) / 100;
    }

    if (trupositive + falsenegative > 0) {
      $scope.thres.sensitivity = Math.round(trupositive / (trupositive + falsenegative) * 100) / 100;
    }

    if (truenegatives + falsepositives > 0) {
      $scope.thres.specificity = Math.round(truenegatives / (truenegatives + falsepositives) * 100) / 100;
    }
  };

  $scope.saveThreshold = function () {
    $scope.messageSaved = '';
    $scope.recalculate();
    a2Models.setThreshold($stateParams.modelId, $scope.currentThreshold).success(function () {
      $scope.messageSaved = 'Threshold saved';
      $scope.model.threshold = $scope.currentThreshold;
    }).error(function () {
      $scope.messageSaved = 'Error saving threshold';
    });
  };

  $scope.recalculate = function () {
    $scope.messageSaved = '';
    var newval = parseFloat($scope.newthres);

    if (!isNaN(newval) && newval <= 1.0 && newval >= 0.0) {
      $scope.currentThreshold = newval;

      for (var jj = 0; jj < $scope.validations.length; jj++) {
        $scope.validations[jj].threshold = $scope.validations[jj].vmax > $scope.currentThreshold ? 'yes' : 'no';
      }

      $scope.computeStats();
    } else {
      $scope.messageSaved = 'Value should be between 0 and 1.';
    }
  }; // TODO use ng-style


  $scope.zoomout = function () {
    $("#patternDivMain").css("min-width", 210);
    $("#patternDivMain").css("height", 100);
  };

  $scope.zoomin = function () {
    $("#patternDivMain").css("min-width", 420);
    $("#patternDivMain").css("height", 150);
  };

  $scope.isExport = function () {
    return a2UserPermit.can('export report') || a2UserPermit.isSuper();
  };

  $scope.getValidations = function () {
    var vals = [];

    for (var i = 0; i < $scope.validations.length; i++) {
      vals.push({
        site: $scope.validations[i].site,
        date: $scope.validations[i].date,
        user: $scope.validations[i].presence,
        model: $scope.validations[i].model,
        threshold: $scope.validations[i].threshold,
        value: $scope.currentThreshold
      });
    }

    return vals;
  };

  $scope.recDetails = function (rec) {
    $scope.selected = rec;
    $scope.showValidationsTable = false;
  };

  $scope.closeRecValidationsDetails = function () {
    $scope.showValidationsTable = true;
    $scope.selected = null;
  };

  $scope.gotoRec = function () {
    var rurl = "/visualizer/rec/" + $scope.selected.id;
    $location.path(rurl);
  };
}]);
angular.module('a2.citizen-scientist.admin.classification-stats', ['a2.services', 'a2.directives', 'ui.bootstrap', 'a2.srv.citizen-scientist-admin', 'angularFileUpload', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('citizen-scientist.admin.classification-stats', {
    url: '/classification-stats/:speciesId?',
    controller: 'A2CitizenScientistAdminClassificationStatsCtrl as controller',
    templateUrl: '/app/citizen-scientist/admin/classification-stats/index.html'
  });
}]).controller('A2CitizenScientistAdminClassificationStatsCtrl', ["$scope", "a2CitizenScientistAdminService", "$stateParams", "$state", "Species", function ($scope, a2CitizenScientistAdminService, $stateParams, $state, Species) {
  this.setSpecies = function (speciesId) {
    this.speciesId = speciesId;
    $state.transitionTo($state.current.name, {
      speciesId: speciesId
    }, {
      notify: false
    });

    if (this.speciesId) {
      this.loadForSpecies();
    }
  };

  this.speciesId = $stateParams.speciesId;

  this.loadPage = function () {
    this.loading = true;
    a2CitizenScientistAdminService.getClassificationStats().then(function (data) {
      this.loading = false;
      this.stats = data.stats;
    }.bind(this));
  };

  this.loadForSpecies = function () {
    this.loadingForSpecies = true;
    Species.findById(this.speciesId).then(function (species) {
      this.species = species;
    }.bind(this));
    a2CitizenScientistAdminService.getClassificationStats(this.speciesId).then(function (data) {
      this.loadingForSpecies = false;
      this.speciesStats = data.stats;
    }.bind(this));
  };

  this.patternMatchingExportUrl = function (row, per_user) {
    return a2CitizenScientistAdminService.getCSExportUrl(row.pattern_matching_id, per_user);
  };

  this.loadPage();

  if (this.speciesId) {
    this.loadForSpecies();
  }
}]);
angular.module('a2.citizen-scientist.admin.settings', ['a2.services', 'a2.srv.citizen-scientist-admin', 'a2.directives', 'ui.bootstrap', 'angularFileUpload', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('citizen-scientist.admin.settings', {
    url: '/settings',
    controller: 'A2CitizenScientistAdminSettingsCtrl as controller',
    templateUrl: '/app/citizen-scientist/admin/settings/index.html'
  });
}]).controller('A2CitizenScientistAdminSettingsCtrl', ["$scope", "a2CitizenScientistAdminService", "notify", function ($scope, a2CitizenScientistAdminService, notify) {
  this.loadPage = function () {
    this.loading = true;
    a2CitizenScientistAdminService.getSettings().then(function (data) {
      this.loading = false;
      this.patternmatchings = data;
    }.bind(this));
  };

  this.save = function () {
    this.saving = true;
    var settings = this.patternmatchings.filter(function (pm) {
      return pm.citizen_scientist || pm.cs_expert;
    }).map(function (pm) {
      return {
        id: pm.id,
        consensus_number: pm.consensus_number,
        citizen_scientist: pm.citizen_scientist,
        cs_expert: pm.cs_expert
      };
    });
    return a2CitizenScientistAdminService.setSettings(settings).then(function (data) {
      this.saving = false;
      notify.log("Settings Saved.");
    }.bind(this)).catch(function () {
      this.saving = false;
      notify.error("An error occured.");
    }.bind(this));
  };

  this.loadPage();
}]);
angular.module('a2.citizen-scientist.admin.user-stats', ['a2.services', 'a2.directives', 'ui.bootstrap', 'a2.srv.citizen-scientist-admin', 'angularFileUpload', 'humane']).config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('citizen-scientist.admin.user-stats', {
    url: '/user-stats/:userId?',
    controller: 'A2CitizenScientistAdminUserStatsCtrl as controller',
    templateUrl: '/app/citizen-scientist/admin/user-stats/index.html'
  });
}]).controller('A2CitizenScientistAdminUserStatsCtrl', ["$scope", "a2CitizenScientistAdminService", "$stateParams", "$state", "Users", function ($scope, a2CitizenScientistAdminService, $stateParams, $state, Users) {
  this.userStatsExportUrl = a2CitizenScientistAdminService.getUserStatsExportUrl();

  this.setUser = function (userId) {
    this.userId = userId;
    $state.transitionTo($state.current.name, {
      userId: userId
    }, {
      notify: false
    });

    if (this.userId) {
      this.loadForUser();
    }
  };

  this.userId = $stateParams.userId;

  this.loadPage = function () {
    this.loading = true;
    a2CitizenScientistAdminService.getUserStats().then(function (data) {
      this.loading = false;
      this.stats = data.stats.filter(function (item) {
        return !!item.user_id;
      });
    }.bind(this));
  };

  this.loadForUser = function () {
    this.loadingForUser = true;
    Users.getInfoForId(this.userId).then(function (user) {
      this.user = user;
    }.bind(this));
    a2CitizenScientistAdminService.getUserStats(this.userId).then(function (data) {
      this.loadingForUser = false;
      this.userStats = data.stats;
    }.bind(this));
  };

  this.loadPage();

  if (this.userId) {
    this.loadForUser();
  }
}]);
angular.module('a2.browser_audio-event-detections', ['a2.browser_common', 'a2.filter.as-csv']).config(["BrowserVisObjectsProvider", "BrowserLOVOsProvider", function (BrowserVisObjectsProvider, BrowserLOVOsProvider) {
  BrowserVisObjectsProvider.add({
    type: 'audio-event-detection',
    cardTemplate: '/app/visualizer/browser/audio-event-detections/card.html'
  });
  BrowserLOVOsProvider.add({
    name: 'audio-event-detection',
    group: 'audio-event-detections',
    vobject_type: 'audio-event-detection',
    icon: 'fa fa-object-group',
    tooltip: "Show Audio Event Detections",
    controller: 'a2BrowserAudioEventDetectionsController',
    template: '/app/visualizer/browser/audio-event-detections/audio-event-detections.html'
  });
}]).controller('a2BrowserAudioEventDetectionsController', ["a2Browser", "AudioEventDetectionService", "a2ArrayLOVO", "$timeout", "$q", function (a2Browser, AudioEventDetectionService, a2ArrayLOVO, $timeout, $q) {
  var self = this;
  this.audioEventDetections = [];
  this.active = false;
  this.loading = {
    audioEventDetections: false
  };
  this.audioEventDetection = null;
  this.lovo = null;
  this.auto = {};

  this.activate = function () {
    var defer = $q.defer();
    AudioEventDetectionService.getList({
      show: 'thumbnail-path'
    }).then(function (audioEventDetections) {
      console.log("audioEventDetections", audioEventDetections);
      self.loading.audioEventDetections = false;
      self.audioEventDetections = audioEventDetections;

      if (!self.audioEventDetections_lovo) {
        self.audioEventDetections_lovo = new a2ArrayLOVO();
      }

      self.audioEventDetections_lovo.setArray(self.audioEventDetections, 'audio-event-detection');

      self.audioEventDetections_lovo.update = function () {
        self.activate();
      };

      if (!self.lovo) {
        self.lovo = self.audioEventDetections_lovo;
        a2Browser.setLOVO(self.lovo);
      }

      defer.resolve(false);

      if (self.resolve.scd) {
        self.resolve.scd.resolve(self.audioEventDetections);
      }
    });
    self.loading.audioEventDetections = true;
    return defer.promise;
  };

  this.resolve = {};

  this.resolve_location = function (location) {
    var m = /(\d+)(\/(\d+))?/.exec(location);
    var defer = $q.defer();

    if (m) {
      var scid = m[1] | 0,
          regionid = m[3] | 0;
      var scd = $q.defer();

      if (self.loading.audioEventDetections) {
        self.resolve = {
          scd: scd
        };
      } else {
        scd.resolve(self.audioEventDetections);
      }

      scd.promise.then(function (audioEventDetections) {
        var audioEventDetection = self.audioEventDetections.filter(function (audioEventDetection) {
          return audioEventDetection.id == scid;
        }).shift();

        if (audioEventDetection) {
          self.audioEventDetection = audioEventDetection;

          if (regionid) {
            if (!self.audioEventDetection.extra) {
              self.audioEventDetection.extra = {};
            }

            self.audioEventDetection.extra.region = regionid;
          }
        }

        defer.resolve(audioEventDetection);
      });
    } else {
      defer.resolve();
    }

    return defer.promise;
  };

  this.get_location = function (audioEventDetection) {
    return 'audio-event-detection/' + audioEventDetection.id + (audioEventDetection.extra && audioEventDetection.extra.region ? '/' + audioEventDetection.extra.region : '');
  };
}]);
angular.module('a2.browser_recordings', ['a2.browser_common', 'a2.browser_recordings_by_site', 'a2.browser_recordings_by_playlist']).config(["BrowserVisObjectsProvider", "BrowserLOVOsProvider", function (BrowserVisObjectsProvider, BrowserLOVOsProvider) {
  BrowserVisObjectsProvider.add({
    type: 'recording',
    cardTemplate: '/app/visualizer/browser/recordings/card.html'
  });
}]);
angular.module('a2.browser_soundscapes', ['a2.browser_common']).config(["BrowserVisObjectsProvider", "BrowserLOVOsProvider", function (BrowserVisObjectsProvider, BrowserLOVOsProvider) {
  BrowserVisObjectsProvider.add({
    type: 'soundscape',
    cardTemplate: '/app/visualizer/browser/soundscapes/card.html'
  });
  BrowserLOVOsProvider.add({
    name: 'soundscape',
    group: 'soundscapes',
    vobject_type: 'soundscape',
    icon: 'fa fa-area-chart',
    tooltip: "Show Soundscapes",
    controller: 'a2BrowserSoundscapesController',
    template: '/app/visualizer/browser/soundscapes/soundscapes.html'
  });
}]).controller('a2BrowserSoundscapesController', ["a2Browser", "a2Soundscapes", "a2ArrayLOVO", "a2UrlUpdate", "Project", "$q", function (a2Browser, a2Soundscapes, a2ArrayLOVO, a2UrlUpdate, Project, $q) {
  var self = this;
  this.soundscapes = [];
  this.active = false;
  this.loading = {
    soundscapes: false
  };
  this.soundscape = null;
  this.lovo = null;
  this.auto = {};

  this.activate = function () {
    var defer = $q.defer();
    a2Soundscapes.getList({
      show: 'thumbnail-path'
    }, function (soundscapes) {
      self.loading.soundscapes = false;
      self.soundscapes = soundscapes;
      self.soundscapes.forEach(function (soundscape) {
        a2UrlUpdate.update(soundscape.thumbnail);
        soundscape.caption2 = soundscape.normalized ? 'normalized' : 'scale:' + (soundscape.visual_max_value !== null ? soundscape.visual_max_value : soundscape.max_value);
      });

      if (!self.soundscapes_lovo) {
        self.soundscapes_lovo = new a2ArrayLOVO();
      }

      self.soundscapes_lovo.setArray(self.soundscapes, 'soundscape');

      self.soundscapes_lovo.update = function () {
        self.activate();
      };

      if (!self.lovo) {
        self.lovo = self.soundscapes_lovo;
        a2Browser.setLOVO(self.lovo);
      }

      defer.resolve(false);

      if (self.resolve.scd) {
        self.resolve.scd.resolve(self.soundscapes);
      }
    });
    self.loading.soundscapes = true;
    return defer.promise;
  };

  this.resolve = {};

  this.resolve_location = function (location) {
    var m = /(\d+)(\/(\d+))?/.exec(location);
    var defer = $q.defer();

    if (m) {
      var scid = m[1] | 0,
          regionid = m[3] | 0;
      var scd = $q.defer();

      if (self.loading.soundscapes) {
        self.resolve = {
          scd: scd
        };
      } else {
        scd.resolve(self.soundscapes);
      }

      scd.promise.then(function (soundscapes) {
        var soundscape = self.soundscapes.filter(function (soundscape) {
          return soundscape.id == scid;
        }).shift();

        if (soundscape) {
          self.soundscape = soundscape;

          if (regionid) {
            if (!self.soundscape.extra) {
              self.soundscape.extra = {};
            }

            self.soundscape.extra.region = regionid;
          }
        }

        defer.resolve(soundscape);
      });
    } else {
      defer.resolve();
    }

    return defer.promise;
  };

  this.get_location = function (soundscape) {
    return 'soundscape/' + soundscape.id + (soundscape.extra && soundscape.extra.region ? '/' + soundscape.extra.region : '');
  };
}]);
angular.module('a2.visualizer.layers.annotation-layer', []).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.annotation-layer.object:annotation-layer
   * @description base image layer.
   * adds the annotation-layer layer_type to layer_types. This layer shows a set of images
   * associated to the visobject (such as the spectrogram or a soundscape's rendering).
   * The layer only has a spectrogram component.
   * The layer requires a selected visobject of recording or soundscape type.
   * The layer has no visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "annotation-layer",
    title: "",
    controller: 'a2VisualizerAnnotationController as controller',
    require: {
      type: ['recording'],
      selection: true
    },
    display: {
      sidebar: false
    },
    visible: true
  });
}]).controller('a2VisualizerAnnotationController', ["$scope", function ($scope) {}]);
angular.module('a2.visualizer.layers.audio-events-layer', []).config(["layer_typesProvider", function (layer_typesProvider) {
  layer_typesProvider.addLayerType({
    type: "audio-events-layer",
    title: "",
    controller: 'a2VisualizerAudioEventsController as audio_events',
    require: {
      type: ['recording'],
      selection: true
    },
    visible: true,
    hide_visibility: true
  });
}]).controller('a2VisualizerAudioEventsController', ["$scope", "a2AudioEventDetectionsClustering", "a2ClusteringJobs", "$localStorage", function ($scope, a2AudioEventDetectionsClustering, a2ClusteringJobs, $localStorage) {
  var self = this;
  const colors = ['#5340ff33', '#008000', '#ffcd00', '#1F57CC', '#53ff40', '#5bc0de', '#5340ff33'];
  self.audioEvents = null;
  self.clusteringEvents = null;
  self.isAudioEventsPlaylist = null;
  self.selectedAudioEventJob = null;
  self.clusterPlaylists = null;
  self.isPlaylist = false;

  self.toggleAudioEvents = function (isJobsBoxes, id, opacity) {
    (isJobsBoxes ? self.audioEvents : self.clusteringEvents).forEach(function (item) {
      if ((isJobsBoxes ? item.job_id : item.playlist_id) === id) {
        item.opacity = opacity === false ? 0 : 1;

        if (isJobsBoxes) {
          const index = Object.keys(self.audioEventJobs).findIndex(function (job) {
            return Number(job) === item.job_id;
          });
          const color = colors[index] || colors[0];
          item.borderColor = self.hexToRGB(color, 0.6);
          item.backgroundColor = self.hexToRGB(color, 0.2);
        }
      }
    }); // Remove default/selected job from the audio events details page.

    if (isJobsBoxes) {
      $localStorage.setItem('analysis.audioEventJob', null);
    }
  };

  self.hexToRGB = function (hex, opacity) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + opacity + ')';
  };

  self.isHighlightTitle = function () {
    return !isNaN($localStorage.getItem('analysis.audioEventJob'));
  };

  self.fetchAudioEvents = function () {
    var rec = $scope.visobject && $scope.visobject_type == 'recording' && $scope.visobject.id;

    if (rec) {
      self.isPlaylist = $scope.visobject.extra && $scope.visobject.extra.playlist; // Check local storage on selected job from the audio events details page.

      try {
        self.selectedAudioEventJob = $localStorage.getItem('analysis.audioEventJob');
        self.isAudioEventsPlaylist = !isNaN(self.selectedAudioEventJob);
      } catch (e) {} // Get Detections Jobs data.


      a2AudioEventDetectionsClustering.list({
        rec_id: rec,
        completed: true
      }).then(function (audioEvents) {
        if (audioEvents) {
          self.audioEventJobs = {}; // Collect detections jobs data for audio events layer.

          if (audioEvents.length) {
            audioEvents.forEach(function (event) {
              if (!self.audioEventJobs[event.job_id]) {
                self.audioEventJobs[event.job_id] = {
                  job_id: event.job_id,
                  name: event.name,
                  count: 1,
                  parameters: event.parameters,
                  visible: self.isAudioEventsPlaylist ? Number(self.selectedAudioEventJob) === event.job_id : false // Job not visible by default, except selected job from the audio events details page.

                };
              }

              ;
              self.audioEventJobs[event.job_id].count += 1;
            });
          }

          self.audioEvents = audioEvents.map(function (event) {
            return {
              rec_id: event.rec_id,
              x1: event.time_min,
              x2: event.time_max,
              y1: event.freq_min,
              y2: event.freq_max,
              job_id: event.job_id || null,
              display: event.rec_id === rec ? "block" : "none",
              opacity: self.isAudioEventsPlaylist ? Number(self.selectedAudioEventJob) === event.job_id ? 1 : 0 : 0 // Boxes not visible by default, except selected job from the audio events details page.

            };
          });
          a2ClusteringJobs.getRoisDetails({
            rec_id: $scope.visobject.id
          }).then(function (clusteringEvents) {
            if (clusteringEvents) {
              // Collect clustering playlists for audio events layer.
              self.clusterPlaylists = {};
              clusteringEvents.forEach(function (event) {
                if (!self.clusterPlaylists[event.playlist_id]) {
                  self.clusterPlaylists[event.playlist_id] = {
                    rec_id: event.recording_id,
                    playlist_name: event.playlist_name,
                    playlist_id: event.playlist_id,
                    count: 1,
                    visible: false // Playlist is hidden by default.

                  };
                }

                ;
                self.clusterPlaylists[event.playlist_id].count += 1;
              });
              self.clusteringEvents = clusteringEvents.map(function (event) {
                return {
                  rec_id: event.recording_id,
                  x1: event.time_min,
                  x2: event.time_max,
                  y1: event.frequency_min,
                  y2: event.frequency_max,
                  playlist_id: event.playlist_id || null,
                  display: event.recording_id === rec ? "block" : "none",
                  opacity: 0 // Boxes not visible by default.

                };
              });
            }
          });
        }
      });
    }
  };

  $scope.$watch('visobject', self.fetchAudioEvents);
}]);
angular.module('a2.visualizer.layers.data-plot-layer', ['a2.directive.plotly-plotter', 'arbimon2.directive.a2-dropdown']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.data-plot-layer.object:data-plot-layer
   * @description base image layer. 
   * adds the data-plot-layer layer_type to layer_types. This layer shows a set of plots
   * related to the visobject.
   * The layer only has a spectrogram component.
   * The layer requires a visobject of type audio-event-detection.
   * The layer has no visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "data-plot-layer",
    title: "",
    controller: 'a2VisualizerDataPlotLayerController as controller',
    require: {
      type: ['audio-event-detection'],
      selection: true
    },
    visible: true,
    hide_visibility: true
  });
}]).controller('a2VisualizerDataPlotLayerController', ["$scope", function ($scope) {}]);
angular.module('a2.visualizer.layers.base-image-layer', []).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.base-image-layer.object:base-image-layer
   * @description base image layer. 
   * adds the base-image-layer layer_type to layer_types. This layer shows a set of images
   * associated to the visobject (such as the spectrogram or a soundscape's rendering).
   * The layer only has a spectrogram component.
   * The layer requires a selected visobject of recording or soundscape type.
   * The layer has no visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "base-image-layer",
    title: "",
    require: {
      type: ['recording', 'soundscape'],
      selection: true
    },
    display: {
      sidebar: false
    },
    visible: true
  });
}]);
angular.module('a2.visualizer.layers.recording-soundscape-region-tags', []).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.recordings.object:recordings-layer
   * @description Recordings layer. 
   * adds the recordings-layer layer_type to layer_types. This layer uses
   * a2.visualizer.layers.recordings.controller:a2VisualizerRecordingLayerController as controller,
   * and requires a visobject of type recording to be selected.
   * The layer has no visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "recording-soundscape-region-tags",
    title: "",
    controller: 'a2VisualizerRecordingSoundscapeRegionTagsLayerController as ctrl',
    require: {
      type: 'recording',
      selection: true,
      that: function (scope) {
        var pl = scope.visobject && scope.visobject.extra && scope.visobject.extra.playlist;
        return pl && pl.soundscape && pl.region;
      }
    },
    sidebar_only: true,
    visible: true,
    hide_visibility: false
  });
}]).controller('a2VisualizerRecordingSoundscapeRegionTagsLayerController', ["$scope", "a2Soundscapes", function ($scope, a2Soundscapes) {
  var self = this;
  self.loading = {};
  self.tag = {
    name: null,
    add: function () {
      var tag = this.name;
      this.name = null;
      a2Soundscapes.addRecordingTag(self.soundscape.id, self.region.id, self.recording.id, tag, function (tag) {
        var tagid = tag.id | 0;

        if (!self.tags.filter(function (t) {
          return t.id == tagid;
        }).length) {
          self.tags.push(tag);
        }
      });
    },
    remove: function (tag) {
      var tagid = tag.id | 0;
      a2Soundscapes.removeRecordingTag(self.soundscape.id, self.region.id, self.recording.id, tagid, function () {
        self.tags = self.tags.filter(function (t) {
          return t.id != tagid;
        });
      });
    }
  };
  $scope.$watch('visobject', function (visobject) {
    self.recording = null;
    self.playlist = null;
    self.soundscape = null;
    self.region = null;
    self.tags = null;

    if (visobject && visobject.type == 'recording' && visobject.id && visobject.extra && visobject.extra.playlist && visobject.extra.playlist.soundscape && visobject.extra.playlist.region) {
      self.recording = visobject;
      self.playlist = visobject.extra.playlist;
      self.loading.soundscape = true;
      self.loading.region = true;
      self.loading.tags = true;
      a2Soundscapes.get(self.playlist.soundscape, function (soundscape) {
        self.loading.soundscape = false;
        self.soundscape = soundscape;
        a2Soundscapes.getRegion(soundscape.id, self.playlist.region, function (region) {
          self.loading.region = false;
          self.region = region;
          a2Soundscapes.getRecordingTags(soundscape.id, region.id, self.recording.id, function (tags) {
            self.loading.tags = false;
            self.tags = tags;
          });
        });
      });
    }
  });
}]);
angular.module('a2.visualizer.layers.recordings', ['a2.filter.round', 'a2.directive.frequency_filter_range_control']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.recordings.object:recordings-layer
   * @description Recordings layer.
   * adds the recordings-layer layer_type to layer_types. This layer uses
   * a2.visualizer.layers.recordings.controller:a2VisualizerRecordingLayerController as controller,
   * and requires a visobject of type recording to be selected.
   * The layer has no visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "recording-layer",
    title: "",
    controller: 'a2VisualizerRecordingLayerController as controller',
    require: {
      type: 'recording',
      selection: true
    },
    visible: true,
    hide_visibility: true
  });
}]).controller('a2VisualizerRecordingLayerController', ["$scope", "$modal", "$location", "$window", function ($scope, $modal, $location, $window) {
  this.setGain = function (gain) {
    $scope.audio_player.setGain(gain).then(function () {
      var gain = $scope.audio_player.gain;
      $scope.location.updateParams({
        gain: gain >= 1 ? gain : undefined
      });
    });
  };

  this.explorerUrl = function () {
    if (!$scope.visobject) return null;
    return $scope.visobject.explorerUrl;
  };

  this.openFreqFilterModal = function () {
    if (!$scope.visobject) {
      return;
    }

    $modal.open({
      templateUrl: '/app/visualizer/layers/recordings/frequency_filter_modal.html',
      controller: 'a2VisualizerFrequencyFilterModalController',
      size: 'sm',
      resolve: {
        data: function () {
          return {
            recording: $scope.visobject,
            filter: $scope.audio_player.freq_filter
          };
        }
      }
    }).result.then($scope.audio_player.setFrequencyFilter.bind($scope.audio_player)).then(function () {
      var filter = $scope.audio_player.freq_filter;
      $scope.location.updateParams({
        filter: filter ? filter.min + '-' + filter.max : undefined
      });
    });
  };
}]).controller('a2VisualizerFrequencyFilterModalController', ["$scope", "$modalInstance", "data", function ($scope, $modalInstance, data) {
  $scope.recording = data.recording;
  $scope.max_freq = data.recording.sample_rate / 2;
  $scope.has_previous_filter = true; //!!data.filter;

  $scope.filter = data.filter ? angular.copy(data.filter) : {
    min: 0,
    max: $scope.max_freq
  };

  $scope.remove_filter = function () {
    $modalInstance.close();
  };

  $scope.apply_filter = function () {
    $modalInstance.close($scope.filter);
  };
}]);
angular.module('a2.visualizer.layers.soundscapes', ['a2.visualizer.layers.soundscapes.info', 'a2.visualizer.layers.soundscapes.regions']);
angular.module('a2.visualizer.layers.zoom-input-layer', []).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.zoom-input-layer.object:zoom-input-layer
   * @description base image layer. 
   * adds the zoom-input-layer layer_type to layer_types. This layer collects input forEach
   * performin zoom actions on the spectrogram.
   */
  layer_typesProvider.addLayerType({
    type: "zoom-input-layer",
    title: "",
    require: {
      type: ['recording', 'soundscape'],
      selection: true,
      that: function (scope) {
        return scope.visobject && scope.visobject.zoomable;
      }
    },
    display: {
      sidebar: false
    },
    visible: true
  });
}]);
angular.module('a2.visualizer.layers.training-sets.roi_set', ['visualizer-services', 'a2.permissions', 'humane']).config(["training_set_typesProvider", function (training_set_typesProvider) {
  training_set_typesProvider.add({
    type: 'roi_set',
    has_layout: true,
    templates: {
      layer_item: '/app/visualizer/layer-item/training-sets/roi_set.html',
      new_modal: '/app/visualizer/modal/new_roi_set_tset_partial.html'
    },
    action: {
      collect_new_tset_data: function (sdata, tset_data, sval) {
        if (sdata.class) {
          tset_data.class = sdata.class.id;
        } else {
          sval.class = "Please select a project class.";
          sval.count++;
        }
      }
    },
    controller: 'a2VisualizerSpectrogramTrainingSetRoiSetData'
  });
}]).controller('a2VisualizerTrainingSetLayerRoiSetDataController', ["$scope", "$timeout", "a2TrainingSets", "training_set_types", "a22PointBBoxEditor", "a2UserPermit", "notify", function ($scope, $timeout, a2TrainingSets, training_set_types, a22PointBBoxEditor, a2UserPermit, notify) {
  var self = this;
  self.type = 'roi_set';
  self.typedef = training_set_types.roi_set;

  $scope.getXCoord = function (x1, x2) {
    return $scope.getXSide(x1, x2) == 'left' ? x1 : x2;
  };

  $scope.getXSide = function (x1, x2) {
    var px = Math.max(0, Math.min($scope.layout.sec2x(x2, 1) / $scope.layout.spectrogram.width, 1));
    return px > .5 ? 'left' : 'right';
  };

  $scope.getTransform = function (x1, x2, y1, y2) {
    var tx = $scope.getXSide(x1, x2) == 'left' ? '-100%' : '0';
    var ty = $scope.getYTranslation((y1 + y2) / 2, true);
    return 'translate(' + tx + ', ' + ty + ')';
  };

  $scope.getYTranslation = function (y, asrelativeoffset) {
    var py = Math.max(0.1, Math.min($scope.layout.hz2y(y, 1) / $scope.layout.spectrogram.height, .9));

    if (asrelativeoffset) {
      py = -py;
    }

    return (100 * py | 0) + '%';
  };

  self.fetchData = function (tsetId, rec) {
    self.tsetId = tsetId;
    self.recording = rec;
    a2TrainingSets.getData(tsetId, rec, function (data) {
      $timeout(function () {
        self.rois = data;
      });
    });
  };

  self.editor = angular.extend(new a22PointBBoxEditor(), {
    reset: function () {
      this.super.reset.call(this);
      this.roi = null;
    },
    make_new_bbox: function () {
      this.super.make_new_bbox.call(this);
      this.roi = this.bbox;
    },
    make_new_roi: function () {
      this.make_new_bbox();
    },
    add_tracer_point: function (point) {
      this.super.add_tracer_point.call(this, point.sec, point.hz);
    },
    add_point: function (point, min_eps) {
      this.super.add_point.call(this, point.sec, point.hz, min_eps);
    },
    submit: function () {
      if (!a2UserPermit.can('manage training sets')) {
        notify.error('You do not have permission to add ROIs to training set');
        return;
      }

      a2TrainingSets.addData(self.tsetId, {
        recording: self.recording,
        roi: this.roi
      }, function (new_tset_data) {
        $timeout(function () {
          this.reset();
          self.rois.push(new_tset_data);
        }.bind(this));
      }.bind(this));
    }
  });
}]);
angular.module('a2.visualizer.layers.training-sets', ['visualizer-services', 'a2.visualizer.layers.training-sets.roi_set', 'a2.utils']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.training-sets.object:training-data
   * @description Training Data layer.
   * adds the training-data layer_type to layer_types. This layer uses
   * a2.visualizer.layers.training-sets.controller:a2VisualizerTrainingSetLayerController as controller,
   * and requires a visobject of type recording to be selected.
   */
  layer_typesProvider.addLayerType({
    type: "training-data",
    title: "",
    controller: 'a2VisualizerTrainingSetLayerController as training_data',
    require: {
      type: 'recording',
      selection: true
    },
    visible: true
  });
}]).controller('a2VisualizerTrainingSetLayerController', ["$scope", "$modal", "$controller", "$timeout", "a2TrainingSets", "a2UserPermit", "notify", function ($scope, $modal, $controller, $timeout, a2TrainingSets, a2UserPermit, notify) {
  var self = this;
  self.tset = null;
  self.tset_type = null;
  self.tset_list = [];
  self.data = null;
  a2TrainingSets.getList(function (training_sets) {
    self.tset_list = training_sets;

    if (!self.tset && training_sets && training_sets.length > 0) {
      self.tset = training_sets[0];
    }
  });

  self.add_new_tset = function () {
    if (!a2UserPermit.can('manage training sets')) {
      notify.error('You do not have permission to create training sets');
      return;
    }

    $modal.open({
      templateUrl: '/app/visualizer/layers/training-data/add_tset_modal.html',
      controller: 'a2VisualizerAddTrainingSetModalController'
    }).result.then(function (new_tset) {
      if (new_tset && new_tset.id) {
        self.tset_list.push(new_tset);

        if (!self.tset) {
          self.tset = new_tset;
        }
      }
    });
  };

  var fetchTsetData = function () {
    var tset = self.tset && self.tset.id;
    var tset_type = self.tset && self.tset.type;
    var rec = $scope.visobject && $scope.visobject_type == 'recording' && $scope.visobject.id;

    if (tset && rec) {
      if (!self.data || self.data.type != tset_type) {
        var cont_name = tset_type.replace(/(^|-|_)(\w)/g, function (_, _1, _2, _3) {
          return _2.toUpperCase();
        });
        cont_name = 'a2VisualizerTrainingSetLayer' + cont_name + 'DataController';
        self.data = $controller(cont_name, {
          $scope: $scope
        });
      }

      self.data.fetchData(tset, rec);
    }
  };

  $scope.$watch(function () {
    return self.tset;
  }, fetchTsetData);
  $scope.$watch('visobject', fetchTsetData);
}]).directive('a2VisualizerSpectrogramTrainingSetData', ["training_set_types", "$compile", "$controller", "$templateFetch", function (training_set_types, $compile, $controller, $templateFetch) {
  return {
    restrict: 'A',
    template: '<div class="training-set-data"></div>',
    replace: true,
    link: function (scope, element, attrs) {
      scope.$watch(attrs.a2VisualizerSpectrogramTrainingSetData, function (tset_type) {
        var type_def = training_set_types[tset_type];
        element.attr('data-tset-type', tset_type);

        if (type_def) {
          if (type_def.has_layout) {
            var tmp_url = '/app/visualizer/spectrogram-layer/training-sets/' + tset_type + '.html';
            $templateFetch(tmp_url, function (tmp) {
              element.empty().append($compile(tmp)(scope));
            });
          }
        }
      });
    }
  };
}]).controller('a2VisualizerAddTrainingSetModalController', ["$scope", "$modalInstance", "Project", "a2TrainingSets", "$state", function ($scope, $modalInstance, Project, a2TrainingSets, $state) {
  $scope.data = {
    name: '',
    type: null
  };
  $scope.loadingClasses = true;
  Project.getClasses(function (project_classes) {
    $scope.project_classes = project_classes;
    $scope.loadingClasses = false;
  });
  $scope.loadingTypes = true;
  a2TrainingSets.getTypes(function (tset_types) {
    $scope.tset_types = tset_types;

    if (tset_types && tset_types.length == 1) {
      $scope.data.type = tset_types[0];
      $scope.loadingTypes = false;
    }
  });

  $scope.goToSpeciesPage = function () {
    $state.go('audiodata.species', {});
  };

  $scope.ok = function () {
    $scope.creating = true;
    $scope.validation = {
      count: 0
    };
    var tset_data = {};

    if ($scope.data.name) {
      tset_data.name = $scope.data.name;
    } else {
      $scope.validation.name = "Training set name is required.";
      $scope.validation.count++;
    }

    if ($scope.data.type && $scope.data.type.id) {
      tset_data.type = $scope.data.type.identifier;
    } else {
      $scope.validation.type = "Training set type is required.";
      $scope.validation.count++;
    }

    if ($scope.data.class) {
      tset_data.class = $scope.data.class.id;
    } else {
      $scope.validation.class = "Species sound is required.";
      $scope.validation.count++;
    } // $scope.form_data=tset_data;


    if ($scope.validation.count === 0) {
      a2TrainingSets.add(tset_data, function (new_tset) {
        if (new_tset.error) {
          var field = new_tset.field || 'error';
          $scope.validation[field] = new_tset.error;
          return;
        }

        $modalInstance.close(new_tset);
      });
    } else {
      $scope.creating = false;
    }
  };
}]);
angular.module('a2.visualizer.layers.species-presence', []).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.species-presence.object:species-presence
   * @description species presence validation layer.
   * Adds the species-presence layer_type to layer_types. This layer shows a
   * species presence validation interface.
   * The layer has spectrogram component.
   * The layer requires a selected visobject of recording type.
   * The layer has visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "species-presence",
    title: "",
    controller: 'a2VisualizerSpeciesPresenceController as species_presence',
    require: {
      type: 'recording',
      selection: true
    },
    visible: true
  });
}]).controller('a2VisualizerSpeciesPresenceController', ["$scope", "a2PatternMatching", "a2AudioEventDetectionsClustering", function ($scope, a2PatternMatching, a2AudioEventDetectionsClustering) {
  var self = this;
  self.speciesPresence = null;
  self.isRemoving = false;

  self.checkSpectroWidth = function (leftBox, widthBox, widthSpectro) {
    return leftBox + widthBox + 200 < widthSpectro;
  };

  self.togglePopup = function (roi) {
    roi.isPopupOpened = !roi.isPopupOpened;
  };

  self.confirmPopup = function (roi) {
    self.isRemoving = true;

    if (roi.aed_id) {
      return a2AudioEventDetectionsClustering.unvalidate({
        aed: [roi.aed_id]
      }).then(function () {
        self.closePopup(roi);
        roi.name = '';
      });
    } else return a2PatternMatching.validateRois(roi.pattern_matching_id, roi.pattern_matching_roi_id, null).then(function () {
      self.closePopup(roi);
      roi.display = "none";
    });
  };

  self.closePopup = function (roi) {
    self.isRemoving = false;
    roi.isPopupOpened = false;
  };

  self.fetchSpeciesPresence = function () {
    var rec = $scope.visobject && $scope.visobject_type == 'recording' && $scope.visobject.id;

    if (rec) {
      a2PatternMatching.list({
        rec_id: rec,
        validated: 1
      }).then(function (rois) {
        self.speciesPresence = rois.map(function (roi) {
          return {
            rec_id: roi.recording_id,
            pattern_matching_id: roi.pattern_matching_id,
            pattern_matching_roi_id: roi.pattern_matching_roi_id,
            name: roi.species_name + ' ' + roi.songtype_name,
            x1: roi.x1,
            x2: roi.x2,
            y1: roi.y1,
            y2: roi.y2,
            display: roi.recording_id === rec ? "block" : "none",
            isPopupOpened: false
          };
        }); // Add validated aed species boxes

        if ($scope.visobject && $scope.visobject.aedValidations && $scope.visobject.aedValidations.length) {
          self.speciesPresence = self.speciesPresence.concat($scope.visobject.aedValidations);
        }
      });
    }
  };

  $scope.$watch('visobject', self.fetchSpeciesPresence);
}]);
angular.module('a2.browser_recordings_by_playlist', ['a2.classy', 'a2.browser_common']).config(["BrowserLOVOsProvider", function (BrowserLOVOsProvider) {
  BrowserLOVOsProvider.add({
    name: 'playlist',
    group: 'recordings',
    vobject_type: 'recording',
    icon: 'fa fa-list',
    tooltip: "Browse Recordings by Playlist",
    controller: 'a2BrowserRecordingsByPlaylistController',
    template: '/app/visualizer/browser/recordings/by-playlist/recordings-by-playlist.html'
  });
}]).service('a2PlaylistLOVO', ["$q", "makeClass", "a2Playlists", "a2Pager", "$state", "$localStorage", "Project", function ($q, makeClass, a2Playlists, a2Pager, $state, $localStorage, Project) {
  return makeClass({
    static: {
      PageSize: 10,
      BlockSize: 7
    },
    constructor: function (playlist) {
      this.loading = false;
      this.playlist = playlist;
      this.object_type = "recording";
      this.offset = 0;
      this.count = 0;
      this.list = [];
      this.whole_list = [];
      var self = this;
      this.paging = new a2Pager({
        item_count: playlist.count,
        page_size: this.constructor.PageSize,
        block_size: this.constructor.BlockSize,
        block_tracks_page: true,
        on_page: function (e) {
          return self.load_page(e.offset, e.count);
        }
      });
    },
    initialize: function () {
      var self = this,
          d = $q.defer();

      if (this.initialized) {
        d.resolve(true);
      } else {
        this.paging.set_page(0).then(function () {
          d.resolve(false);
        });
      }

      if (self.playlist && self.playlist.id === 0) {
        d.resolve(true);
        return d.promise;
      }

      ;
      return d.promise.then(function () {
        a2Playlists.getInfo(self.playlist.id, function (playlist_info) {
          self.playlist = playlist_info;
        });
      }).then(function () {
        if (self.whole_list) {
          self.whole_list.forEach(self.append_extras.bind(self));
        }
      });
    },
    load_page: function (offset, count) {
      var self = this,
          d = $q.defer();
      var opts = {
        offset: offset,
        limit: count,
        show: 'thumbnail-path'
      }; // get recordings data for temporary clusters playlist

      if ($state.params.clusters) {
        var clustersData = JSON.parse($localStorage.getItem('analysis.clusters'));

        if (clustersData && clustersData.playlist && clustersData.playlist.recordings) {
          opts.recordings = clustersData.playlist.recordings.filter(function (id, i, a) {
            return i >= opts.offset && i < opts.offset + opts.limit;
          });
          self.count = clustersData.playlist.recordings.length;
        }
      }

      ;
      self.loading = true;
      a2Playlists.getData(self.playlist.id, opts, function (recordings) {
        self.list = recordings;
        recordings.forEach(function (recording) {
          recording.caption = [recording.site, moment.utc(recording.datetime).format('lll')].join(', ');
          recording.vaxis = {
            font: '7px',
            color: '#333333',
            range: [0, recording.sample_rate / 2000],
            count: 5,
            unit: ''
          };
          self.append_extras(recording);
        });
        self.loading = false;
        d.resolve(recordings);
      });
      return d.promise;
    },
    append_extras: function (recording) {
      if (recording) {
        recording.extra = {
          playlist: this.playlist
        };
      }

      return recording;
    },
    find_local: function (recording) {
      var self = this;
      var id = recording && recording.id || recording | 0; // console.log(":: find : ", id);

      return $q.resolve(this.append_extras(this.list && this.list.filter(function (r) {
        // if(r.id == id){
        // console.log("     :: found", r.id, r);
        // }
        return r.id == id;
      }).shift()));
    },
    find: function (recording) {
      var self = this;
      var d = $q.defer();
      var id = recording && recording.id || recording | 0;
      self.find_local(recording).then(function (found_rec) {
        if (found_rec) {
          d.resolve(found_rec);
        } else {
          a2Playlists.getRecordingPosition(self.playlist.id, id).then(function (response) {
            return self.paging.set_page(self.paging.page_for(response.data));
          }).then(function (recordings) {
            return self.find_local(recording);
          }).then(function (found_rec) {
            d.resolve(found_rec);
          });
        }
      });
      return d.promise;
    },
    previous: function (recording) {
      var self = this;
      var d = $q.defer(),
          id = recording && recording.id || recording | 0;
      a2Playlists.getPreviousRecording(this.playlist.id, id, function (r) {
        d.resolve(self.append_extras(r));
      });
      return d.promise;
    },
    next: function (recording) {
      var self = this;
      var d = $q.defer(),
          id = recording && recording.id || recording | 0;
      a2Playlists.getNextRecording(this.playlist.id, id, function (r) {
        d.resolve(self.append_extras(r));
      });
      return d.promise;
    }
  });
}]).factory('a2Pager', ["makeClass", function (makeClass) {
  return makeClass({
    constructor: function (options) {
      this.block_size = 10;
      this.last_page = 0;
      this.set_options(options);
    },
    resolve_value: function (value, current, first, last) {
      switch (value) {
        case 'first':
          value = first;
          break;

        case 'previous':
          value = current - 1;
          break;

        case 'next':
          value = current + 1;
          break;

        case 'last':
          value = last;
          break;
      }

      return Math.max(first, Math.min(+value, last));
    },
    set_options: function (options) {
      if (options.item_count) {
        this.item_count = options.item_count;
      }

      if (options.page_size) {
        this.page_size = options.page_size;
      }

      if (options.block_size) {
        this.block_size = options.block_size;
      }

      if (options.last_page) {
        this.last_page = options.last_page;
      }

      if (options.block_tracks_page !== undefined) {
        this.block_tracks_page = !!options.block_tracks_page;
      }

      if (options.on_page !== undefined) {
        this.on_page = options.on_page;
      }

      this.update();
    },
    page_for: function (item) {
      var page = item / this.page_size | 0;
      console.log("page_for(%s) :: %s", item, page);
      return page;
    },
    set_page: function (page) {
      this.current_page = this.resolve_value(page, this.current_page, 0, this.last_page) | 0;
      this.is_at_first_page = this.current_page === 0;
      this.is_at_last_page = this.current_page === this.last_page;

      if (this.block_tracks_page) {
        this.show_block((this.current_page - this.block_size / 2 + this.block_size % 2) / this.block_size);
      } else {
        this.show_block(this.current_page / this.block_size);
      }

      if (this.on_page instanceof Function) {
        var offset = this.current_page * this.page_size;
        return this.on_page({
          page: this.current_page,
          offset: offset,
          count: Math.min(this.page_size, this.item_count - offset + 1)
        });
      }
    },
    update: function () {
      this.is_at_first_page = this.current_page <= 0;
      this.last_page = (this.item_count - 1) / this.page_size | 0;
      this.last_page_block = this.last_page / this.block_size | 0;
      this.is_at_last_page = this.current_page >= this.last_page;
      this.show_block(this.block);
    },
    show_block: function (block) {
      if (this.block_tracks_page) {
        this.current_page_block = this.resolve_value(block, this.current_page_block, 0, this.last_page_block);
      } else {
        this.current_page_block = this.resolve_value(block, this.current_page_block, 0, this.last_page_block) | 0;
      }

      this.is_at_first_page_block = this.current_page_block <= 0;
      this.is_at_last_page_block = this.current_page_block >= this.last_page_block;
      this.current_page_block_first_page = this.current_page_block * this.block_size | 0;
      this.current_page_block_last_page = Math.min((this.current_page_block + 1) * this.block_size - 1 | 0, this.last_page);
      this.block = [];

      for (var i = this.current_page_block_first_page, e = this.current_page_block_last_page; i <= e; ++i) {
        this.block.push(i);
      }
    },
    has_page: function (page) {
      return 0 <= page && page <= this.last_page;
    }
  });
}]).controller('a2BrowserRecordingsByPlaylistController', ["$scope", "a2Browser", "a2Playlists", "$q", "a2PlaylistLOVO", "$state", "$localStorage", function ($scope, a2Browser, a2Playlists, $q, a2PlaylistLOVO, $state, $localStorage) {
  var self = this;
  this.playlists = [];
  this.active = false;
  this.loading = {
    playlists: false
  };
  this.playlist = null;
  this.lovo = null;
  this.auto = {};

  this.activate = function () {
    self.loading.playlists = true;
    this.getPlaylists = a2Playlists.getList().then(function (playlists) {
      // add temporary clusters playlist to playlists' array
      if ($state.params.clusters) {
        var clustersData = JSON.parse($localStorage.getItem('analysis.clusters'));

        if (clustersData && clustersData.playlist) {
          playlists.push(clustersData.playlist);
        }
      }

      self.playlists = playlists;
      self.loading.playlists = false;
    }).then(function () {
      self.active = true;

      if (self.resolve.pld) {
        self.resolve.pld.resolve(playlists);
        delete self.resolve.pld;
      }
    }).then(function () {
      return self.playlists;
    });
    return this.getPlaylists;
  };

  this.deactivate = function () {
    self.active = false;
  };

  this.resolve = {};

  this.resolve_link = function (link) {
    if (link.location) {
      a2Browser.set_location(link.location);
    }
  };

  this.resolve_location = function (location) {
    var m = /(\d+)(\/(\d+))?/.exec(location);
    return m ? $q.resolve().then(function () {
      var plid = m[1] | 0,
          recid = m[3] | 0;
      return self.getPlaylists.then(function (playlists) {
        var playlist = self.playlists.filter(function (playlist) {
          return playlist.id == plid;
        }).shift();

        if (playlist) {
          self.playlist = playlist;
          self.lovo = new a2PlaylistLOVO(playlist);
          return self.lovo.initialize().then(function () {
            return a2Browser.setLOVO(self.lovo);
          }).then(function () {
            return self.lovo.find(recid);
          }).then(function (recording) {
            return recording;
          });
        }
      });
    }) : $q.resolve();
  };

  this.get_location = function (recording) {
    return 'playlist/' + (this.lovo ? this.lovo.playlist.id + (recording ? "/" + recording.id : '') : '');
  };

  this.set_playlist = function (playlist) {
    this.playlist = playlist;

    if (!self.active) {
      return;
    }

    if (self.lovo && self.lovo.playlist.id != playlist.id) {
      $scope.removeFromLocalStorage();
    }

    if (playlist && (self.lovo ? self.lovo.playlist != playlist : true)) {
      self.lovo = new a2PlaylistLOVO(playlist);
    }

    a2Browser.setLOVO(self.lovo, self.lovo ? "playlist/" + self.lovo.playlist.id : '');
  };

  $scope.removeFromLocalStorage = function () {
    $localStorage.setItem('analysis.clusters', null);
    $localStorage.setItem('analysis.clusters.playlist', null);
    $state.params.clusters = '';
  };
}]);
angular.module('a2.browser_recordings_by_site', ['a2.browser_common']).config(["BrowserLOVOsProvider", function (BrowserLOVOsProvider) {
  BrowserLOVOsProvider.add({
    name: 'rec',
    group: 'recordings',
    vobject_type: 'recording',
    default: true,
    icon: 'fa fa-map-marker',
    tooltip: 'Browse Recordings by Site',
    controller: 'a2BrowserRecordingsBySiteController',
    template: '/app/visualizer/browser/recordings/by-site/recordings-by-site.html'
  });
}]).factory('rbDateAvailabilityCache', ["$cacheFactory", function ($cacheFactory) {
  return $cacheFactory('recordingsBrowserDateAvailabilityCache');
}]).service('a2RecordingsBySiteLOVO', ["$q", "Project", "$filter", function ($q, Project, $filter) {
  var lovo = function (site, date, limit, offset, recording_id) {
    this.loading = false;
    this.initialized = false;
    this.site = site;
    this.date = date;
    this.object_type = "recording";
    this.recordingsBySite = true;
    this.offset = offset || 0;
    this.limit = limit;
    this.order = 'datetime';
    this.count = 0;
    this.list = [];
    this.page = 0;
    this.recording_id = recording_id;
    this.finished = false;
  };

  lovo.prototype = {
    initialize: function () {
      var d = $q.defer();

      if (this.initialized) {
        d.resolve(true);
      } else {
        return this.loadNext();
      }

      return d.promise;
    },
    updateRecording: function (recording_id) {
      this.recording_id = recording_id;
    },
    getRecordings: function (limit, offset, recording_id) {
      var d = $q.defer();
      this.limit = limit, this.offset = offset;
      var site = this.site,
          date = this.date;
      var key = ['!q:' + site.id, date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
      var opts = {
        show: 'thumbnail-path'
      };

      if (recording_id === undefined) {
        opts.limit = limit;
        opts.offset = offset;
      }

      ;

      if (recording_id !== undefined) {
        opts.recording_id = recording_id;
      }

      ;
      this.loading = true;
      Project.getRecordings(key, opts, function (recordings) {
        recordings = $filter('orderBy')(recordings, 'datetime');
        recordings.forEach(function (recording) {
          recording.caption = [recording.site, moment.utc(recording.datetime).format('lll')].join(', ');
          recording.vaxis = {
            font: '7px',
            color: '#333333',
            range: [0, recording.sample_rate / 2000],
            count: 5,
            unit: ''
          };
        });

        if (recordings && recordings.length) {
          // not use infinite-scroll functionality for navigating recording
          if (recording_id) {
            if (angular.equals(this.list, recordings)) {
              this.finished = true;
            }

            ;
            this.list = [];
            this.list = recordings;
          } else {
            this.list.push.apply(this.list, recordings);
            this.page++;
          }
        } else {
          this.finished = true;
        }

        this.count += recordings.length;
        this.loading = false;
        d.resolve(false);
      }.bind(this));
      return d.promise;
    },
    loadNext: function () {
      if (this.finished) {
        return $q.defer().resolve(false);
      }

      return this.getRecordings(this.limit, this.page * this.limit, this.recording_id);
    },
    find: function (recording) {
      var d = $q.defer(),
          id = recording && recording.id || recording | 0;
      d.resolve(this.list.filter(function (r) {
        return r.id == id;
      }).shift());
      return d.promise;
    },
    previous: function (recording) {
      console.log("previous : function(recording){ :: ", recording);
      var d = $q.defer(),
          id = recording && recording.id || recording | 0;
      Project.getPreviousRecording(id, d.resolve);
      return d.promise;
    },
    next: function (recording) {
      var d = $q.defer(),
          id = recording && recording.id || recording | 0;
      Project.getNextRecording(id, d.resolve);
      return d.promise;
    }
  };
  return lovo;
}]).controller('a2BrowserRecordingsBySiteController', ["$scope", "a2Browser", "rbDateAvailabilityCache", "Project", "$timeout", "$q", "a2RecordingsBySiteLOVO", function ($scope, a2Browser, rbDateAvailabilityCache, Project, $timeout, $q, a2RecordingsBySiteLOVO) {
  var project = Project;
  var self = this;
  $scope.siteInfo = {};
  this.sites = [];
  this.dates = {
    refreshing: false,
    max_date: null,
    min_date: null,
    display_year: null,
    date_counts: [],
    datepickerMode: 'year',
    cache: rbDateAvailabilityCache,
    get_counts_for: function (year) {
      var site = self.site;
      var site_id = site && site.id;

      if (!site_id) {
        return true;
      }

      var key = ['!q:' + site_id, year, '[1:12]'].join('-');
      var availability = self.dates.cache.get(key);

      if (!availability) {
        self.dates.fetch_counts(key);
      } else if (availability.data) {
        self.dates.date_counts = availability.data;
      }
    },
    fetch_counts: function (key) {
      self.dates.cache.put(key, {
        fetching: true
      });
      self.loading.dates = true;
      Project.getRecordingAvailability(key, function (data) {
        $timeout(function () {
          var avail = {};

          for (var site in data) {
            var site_years = data[site];

            for (var year in site_years) {
              var year_months = site_years[year];

              for (var month in year_months) {
                var month_days = year_months[month];

                for (var day in month_days) {
                  var akey = year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
                  avail[akey] = (avail[akey] | 0) + month_days[day];
                }
              }
            }
          }

          self.dates.cache.get(key).data = avail || {};
          self.dates.date_counts = avail;
          self.loading.dates = false;
        });
      });
    },
    fetch_year_range: function (site, callback) {
      var site_id = site && site.id;

      if (!site_id) {
        return;
      }

      Project.getRecordingAvailability('!q:' + site_id, function (data) {
        $timeout(function () {
          var range = {
            max: -1 / 0,
            min: 1 / 0,
            count: 0
          };

          for (var site in data) {
            var site_years = data[site];

            for (var year in site_years) {
              range.count++;
              range.min = Math.min(year, range.min);
              range.max = Math.max(year, range.max);
            }
          }

          if (!range.count) {
            range.max = range.min = new Date().getFullYear();
          }

          self.dates.min_date = new Date(range.min, 0, 1, 0, 0, 0, 0);
          self.dates.max_date = new Date(range.max, 11, 31, 23, 59, 59, 999);
          self.loading.dates = false;
          callback(range);
        });
      });
    },
    fetching: false,
    available: {}
  };
  this.loading = {
    sites: false,
    dates: false,
    records: false
  };
  this.auto = {};
  this.site = null;
  this.date = null;
  this.lovo = null;
  $scope.limit = 10;

  this.activate = function () {
    var defer = $q.defer();
    self.loading.sites = true;
    project.getSites({
      count: true,
      logs: true
    }, function (sites) {
      self.sites = sites;
      self.loading.sites = false;
      $timeout(function () {
        self.active = true;
        defer.resolve(sites);
      });
    });
    return defer.promise;
  };

  this.deactivate = function () {
    var defer = $q.defer();
    defer.resolve();
    self.active = false;
    return defer.promise;
  }; // Preselect of a site and a date from navigation URL


  this.auto_select = function (recording) {
    if (recording) {
      var utcdateaslocal = new Date(recording.datetime);
      var recdate = new Date(utcdateaslocal.getTime() + utcdateaslocal.getTimezoneOffset() * 60 * 1000);
      self.auto = {
        site: self.sites.filter(function (s) {
          return s.name == recording.site;
        }).pop(),
        date: new Date(recdate.getFullYear(), recdate.getMonth(), recdate.getDate(), 0, 0, 0, 0)
      };

      if (self.site != self.auto.site) {
        self.set_site(self.auto.site);
      } else if (self.date != self.auto.date) {
        self.set_date(self.auto.date);
      } else {
        a2Browser.setLOVO(make_lovo());
      }
    }
  };

  this.resolve_location = function (location) {
    var defer = $q.defer();

    if (location) {
      var site_match = /^site(\/(\d+)(\/([^/]+))?)?/.exec(location);

      if (site_match) {
        var site = site_match[2] | 0,
            query = site_match[4];

        if (site) {
          var key = '!q:' + site + (query ? '-' + query : '');
          Project.getRecordings(key, function (recordings) {
            defer.resolve(recordings && recordings.pop());
          }.bind(this));
        } else {
          defer.resolve();
        }
      } else {
        Project.getOneRecording(location, function (recording) {
          defer.resolve(recording);
        });
      }
    } else {
      defer.resolve();
    }

    return defer.promise;
  };

  this.get_location = function (recording) {
    return 'rec/' + recording.id;
  };

  var make_lovo = function () {
    var site = self.site;
    var date = self.date;

    if (site && date) {
      // Create current browser state for the one recording in the list of recordings
      if ($scope.browser.currentRecording) {
        self.lovo = new a2RecordingsBySiteLOVO(site, date, null, null, Number($scope.browser.currentRecording));
      } else {
        self.lovo = new a2RecordingsBySiteLOVO(site, date, $scope.limit);
      }
    }

    return self.lovo;
  };

  $scope.onScroll = function ($event, $controller) {
    $scope.scrollElement = $controller.scrollElement;
    var scrollTop = $controller.scrollElement.scrollTop();
    var scrollHeight = $controller.scrollElement[0].scrollHeight;
    var elementHeight = $controller.scrollElement.height();
    var diff = scrollTop + elementHeight > scrollHeight * 0.9;

    if (diff) {
      if (!self.lovo) return;
      if (self.lovo && self.lovo.loading === true) return;
      if ($scope.browser.currentRecording && $scope.browser.annotations) return;
      if (self.lovo.list && self.lovo.list.length < 7) return;
      self.lovo.loadNext();
    }
  };

  this.set_dates_display_year = function (new_display_year) {
    this.dates.display_year = new_display_year;

    if (!this.active) {
      return;
    }

    this.dates.get_counts_for(new_display_year);
  };

  this.set_site = function (newValue) {
    this.site = $scope.siteInfo.site = newValue;

    if (!this.active) {
      return;
    }

    this.recordings = []; // reset the selections and stuff

    this.date = null;
    a2Browser.recording = null; // setup auto-selection

    var auto_select = this.auto && this.auto.date;

    if (auto_select) {
      this.auto.date = null;
      this.set_date(auto_select);
    } // reset date picker year range and counts


    this.dates.fetch_year_range(newValue, function (year_range) {
      $timeout(function () {
        self.dates.display_year = year_range.max;
        self.dates.get_counts_for(self.dates.display_year);
      });
    });
  };

  this.set_date = function (date) {
    if (!self.active) {
      return;
    }

    this.yearpickOpen = false;
    var site = this.site;
    this.date = $scope.siteInfo.date = date;

    if (site && date) {
      var isNewSiteAndDate = function () {
        return this.lovo && date && this.lovo.date && date.getTime() === this.lovo.date.getTime() && site.id === this.lovo.site.id;
      };

      if (isNewSiteAndDate()) {
        a2Browser.setLOVO(self.lovo);
      } else {
        a2Browser.setLOVO(make_lovo()).then(function () {
          $scope.browser.currentRecording = null;
          $scope.browser.annotations = null;
        });
      }
    }
  };
}]);
angular.module('a2.visualizer.layers.soundscapes.info', ['visualizer-services', 'a2.utils', 'a2.soundscapeRegionTags', 'a2.url-update-service', 'a2.directives', 'a2.directive.a2-palette-drawer', 'a2.service.colorscale-gradients']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.soundscapes.info.object:soundscape-info-layer
   * @description Soundscape Info layer. 
   * adds the soundscape-info-layer layer_type to layer_types. This layer uses
   * a2.visualizer.layers.soundscapes.info.controller:a2VisualizerSoundscapeInfoLayerController as controller,
   * and requires a visobject of type soundscape to be selected.
   * The layer has a visibility button.
   * The layer does not have an associated spectrogram layer.
   */
  layer_typesProvider.addLayerType({
    type: "soundscape-info-layer",
    title: "",
    controller: 'a2VisualizerSoundscapeInfoLayerController as info',
    require: {
      type: 'soundscape',
      browsetype: 'soundscape',
      selection: true
    },
    display: {
      spectrogram: false
    },
    visible: true,
    hide_visibility: true
  });
}]).controller('a2VisualizerSoundscapeInfoLayerController', ["$scope", "$modal", "$location", "a2Soundscapes", "a2UserPermit", "notify", function ($scope, $modal, $location, a2Soundscapes, a2UserPermit, notify) {
  var self = this;
  a2Soundscapes.getAmplitudeReferences().then(function (amplitudeReferences) {
    this.amplitudeReferences = amplitudeReferences.reduce(function (_, item) {
      _[item.value] = item;
      return _;
    }, {});
  }.bind(this));

  this.edit_visual_scale = function (soundscape) {
    if (!a2UserPermit.can('manage soundscapes')) {
      notify.error('You do not have permission to edit soundscapes');
      return;
    }

    $modal.open({
      templateUrl: '/app/visualizer/layers/soundscapes/info/edit_soundscape_visual_scale_modal.html',
      controller: 'a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController as controller',
      // size        : 'sm',
      resolve: {
        amplitudeReferences: ["a2Soundscapes", function (a2Soundscapes) {
          return a2Soundscapes.getAmplitudeReferences();
        }],
        data: function () {
          return {
            soundscape: soundscape
          };
        }
      }
    }).result.then(function () {/// TODO::: aaa
    });
  };
}]).controller('a2VisualizerSampleSoundscapeInfoEditVisualScaleModalController', ["$scope", "$modalInstance", "a2Soundscapes", "amplitudeReferences", "data", "a2UrlUpdate", "ColorscaleGradients", function ($scope, $modalInstance, a2Soundscapes, amplitudeReferences, data, a2UrlUpdate, ColorscaleGradients) {
  var soundscape = data.soundscape;
  $scope.soundscape = soundscape;
  $scope.palettes = ColorscaleGradients.gradients;
  $scope.data = {
    palette: soundscape.visual_palette,
    visual_max: soundscape.visual_max_value || soundscape.max_value,
    normalized: !!soundscape.normalized,
    amplitudeThreshold: soundscape.threshold,
    amplitudeReference: amplitudeReferences.reduce(function (_, item) {
      return _ || (item.value == soundscape.threshold_type ? item : null);
    }, null)
  };
  this.amplitudeReferences = amplitudeReferences;

  $scope.ok = function () {
    a2Soundscapes.setVisualizationOptions(soundscape.id, {
      max: $scope.data.visual_max,
      palette: $scope.data.palette,
      normalized: $scope.data.normalized,
      amplitude: $scope.data.amplitudeThreshold,
      amplitudeReference: $scope.data.amplitudeReference.value
    }, function (sc) {
      if (soundscape.update) {
        soundscape.update(sc);
      }

      a2UrlUpdate.update(soundscape.thumbnail);
      $modalInstance.close();
    });
  };

  console.log($scope);
}]).directive('a2SoundscapeDrawer', ["a2Soundscapes", function (a2Soundscapes) {
  return {
    restrict: 'E',
    template: '<canvas class="soundscape"></canvas>',
    scope: {
      soundscape: '&',
      normalized: '&',
      amplitudeThreshold: '&',
      amplitudeThresholdType: '&',
      palette: '&',
      visualMax: '&'
    },
    replace: true,
    link: function ($scope, $element, $attrs) {
      var scidx;
      var soundscape;
      var norm_vector;

      var draw = function () {
        if (!soundscape || !scidx) {
          return;
        }

        var vmax = $scope.visualMax() || soundscape.max_value;
        var ampTh = $scope.amplitudeThreshold && $scope.amplitudeThreshold() || 0;

        if ($scope.amplitudeThresholdType() == 'relative-to-peak-maximum') {
          var maxAmp = getMaxAmplitude();
          ampTh *= maxAmp;
        }

        var pal = $scope.palette();

        if (!pal || !pal.length) {
          return;
        }

        var pallen1 = 1.0 * (pal.length - 1);

        var color = function (v) {
          var i = Math.max(0, Math.min(v * pallen1 / vmax | 0, pallen1));
          return pal[i];
        };

        if (norm_vector) {
          vmax = 1;
          var _cl = color;

          color = function (v, j) {
            var n = norm_vector[j] || 1;
            return _cl(v / n);
          };
        }

        var w = scidx.width,
            h = scidx.height;
        $element.attr('width', w);
        $element.attr('height', h);
        var ctx = $element[0].getContext('2d');
        ctx.fillStyle = color(0);
        ctx.fillRect(0, 0, w, h);

        for (var i in scidx.index) {
          var row = scidx.index[i];

          for (var j in row) {
            var cell = row[j];

            if (ampTh && cell[1]) {
              var act = 0;

              for (var al = cell[1], ali = 0, ale = al.length; ali < ale; ++ali) {
                if (al[ali] > ampTh) {
                  ++act;
                }
              }

              ctx.fillStyle = color(act, j);
            } else {
              ctx.fillStyle = color(cell[0], j);
            }

            ctx.fillRect(j, h - i - 1, 1, 1);
          }
        }
      };

      var getMaxAmplitude = function () {
        if (scidx.__maxAmplitude === undefined) {
          scidx.__maxAmplitude = Object.keys(scidx.index).reduce(function (maxAmp, i) {
            var row = scidx.index[i];
            return Object.keys(row).reduce(function (maxAmp, j) {
              var cellMax = Math.max.apply(Math, row[j][1] || [0]);
              return Math.max(cellMax, maxAmp);
            }, maxAmp);
          }, 0);
          console.log("scidx.__maxAmplitude", scidx.__maxAmplitude);
        }

        return scidx.__maxAmplitude;
      };

      $scope.$watch('soundscape()', function (_soundscape) {
        soundscape = _soundscape;
        if (soundscape) a2Soundscapes.getSCIdx(soundscape.id, {
          count: 1
        }).then(function (_scidx) {
          scidx = _scidx;
          draw();
        });
      });
      $scope.$watch('normalized()', function (_normalized) {
        if (!_normalized) {
          norm_vector = null;
          draw();
        } else {
          if (norm_vector) {
            draw();
          } else {
            a2Soundscapes.getNormVector(soundscape.id).then(function (_norm_vector) {
              norm_vector = _norm_vector;
              draw();
            });
          }
        }
      });
      $scope.$watch('palette()', draw);
      $scope.$watch('amplitudeThreshold()', draw);
      $scope.$watch('amplitudeThresholdType()', draw);
      $scope.$watch('visualMax()', draw);
    }
  };
}]);
angular.module('a2.visualizer.layers.soundscapes.regions', ['visualizer-services', 'a2.utils', 'a2.soundscapeRegionTags']).config(["layer_typesProvider", function (layer_typesProvider) {
  /**
   * @ngdoc object
   * @name a2.visualizer.layers.soundscapes.regions.object:soundscape-regions-layer
   * @description Soundscape Regions layer. 
   * adds the soundscape-regions-layer layer_type to layer_types. This layer uses
   * a2.visualizer.layers.soundscapes.regions.controller:a2VisualizerSoundscapeRegionsLayerController as controller,
   * and requires a visobject of type soundscape to be selected.
   * The layer has a visibility button.
   */
  layer_typesProvider.addLayerType({
    type: "soundscape-regions-layer",
    title: "",
    controller: 'a2VisualizerSoundscapeRegionsLayerController as soundscape',
    require: {
      type: 'soundscape',
      browsetype: 'soundscape',
      selection: true
    },
    visible: true // hide_visibility : true

  });
}]).controller('a2VisualizerSoundscapeRegionsLayerController', ["$scope", "$modal", "$location", "a2Soundscapes", "a22PointBBoxEditor", "a2UserPermit", "notify", function ($scope, $modal, $location, a2Soundscapes, a22PointBBoxEditor, a2UserPermit, notify) {
  var self = this;

  var bbox2string = function (bbox) {
    var x1 = bbox.x1 | 0;
    var y1 = bbox.y1 | 0;
    var x2 = bbox.x2 | 0;
    var y2 = bbox.y2 | 0;
    return x1 + ',' + y1 + '-' + x2 + ',' + y2;
  };

  a2Soundscapes.getAmplitudeReferences().then(function (amplitudeReferences) {
    this.amplitudeReferences = amplitudeReferences.reduce(function (_, item) {
      _[item.value] = item;
      return _;
    }, {});
  }.bind(this));
  this.show = {
    names: true,
    tags: true
  };

  this.view_playlist = function (region) {
    console.log("this.view_playlist = function(region){", region);

    if (region.playlist) {
      $scope.set_location("playlist/" + region.playlist);
    }
  };

  this.query = function (bbox) {
    if (!self.selection.valid) {
      return;
    }

    a2Soundscapes.getRecordings(self.soundscape, bbox2string(bbox), {
      count: 1,
      threshold: 1
    }, function (data) {
      bbox.q = data;
    });
  };

  this.submit = function (bbox, name) {
    if (!self.selection.valid) {
      return;
    }

    if (!a2UserPermit.can('manage soundscapes')) {
      notify.error('You do not have permission to annotate soundscapes');
      return;
    }

    a2Soundscapes.addRegion(self.soundscape, bbox2string(bbox), {
      name: name,
      threshold: 1
    }, function (data) {
      self.regions.push(data);
      self.selection.bbox = data;
    });
  };

  this.sample = function (bbox, percent) {
    if (!bbox.id) {
      return;
    }

    $modal.open({
      templateUrl: '/app/visualizer/layers/soundscapes/regions/sample_soundscape_region_modal.html',
      controller: 'a2VisualizerSampleSoundscapeRegionModalController',
      size: 'sm',
      resolve: {
        data: function () {
          return {
            soundscape: self.soundscape,
            region: bbox
          };
        }
      }
    }).result.then(function (region) {
      if (region && region.id) {
        self.regions.forEach(function (r, idx) {
          if (r.id == region.id) {
            self.regions[idx] = region;
          }
        });
        self.selection.bbox = region;
      }
    });
  };

  this.selection = angular.extend(new a22PointBBoxEditor(), {
    reset: function () {
      this.super.reset.call(this);
      this.percent = 100;
      return this;
    },
    quantize: function (x, y, ceil) {
      var q = ceil ? Math.ceil : Math.floor;
      var xi = $scope.visobject.domain.x.unit_interval;
      var yi = $scope.visobject.domain.y.unit_interval;
      return [q(x / xi) * xi, q(y / yi) * yi];
    },
    add_tracer_point: function (x, y) {
      this.super.add_tracer_point.apply(this, this.quantize(x, y));
      return this;
    },
    add_point: function (x, y) {
      this.super.add_point.apply(this, this.quantize(x, y));
      return this;
    },
    validate: function (tmp_points) {
      this.super.validate.call(this, tmp_points);
      var q = this.quantize(this.bbox.x2 + 0.1, this.bbox.y2 + 0.1, true);
      this.bbox.y2 = q[1];
      this.selbox = {
        x1: this.bbox.x1,
        y1: this.bbox.y1,
        x2: q[0],
        y2: q[1]
      };
    },
    query: function () {
      self.query(this.bbox);
    },
    submit: function () {
      self.submit(this.bbox, this.bbox.name);
    },
    sample: function () {
      self.sample(this.bbox, this.percent);
    },
    view_samples: function () {
      self.view_playlist(this.bbox);
    },
    select: function (region) {
      this.bbox = region;

      if ($scope.visobject && $scope.visobject.id && region && region.id) {
        $scope.set_location('soundscape/' + $scope.visobject.id + '/' + region.id, true);
      }
    }
  });
  $scope.$watch('visobject', function (visobject) {
    var sc = visobject && visobject.type == 'soundscape' && visobject.id;

    if (sc) {
      self.soundscape = sc;
      self.selection.reset();
      a2Soundscapes.getRegions(sc, {
        view: 'tags'
      }, function (regions) {
        self.regions = regions;

        if (visobject.extra && visobject.extra.region) {
          self.selection.bbox = self.regions.filter(function (r) {
            return r.id == visobject.extra.region;
          }).pop();
        }
      });
    } else {
      self.soundscape = 0;
    }
  });
}]).controller('a2VisualizerSampleSoundscapeRegionModalController', ["$scope", "$modalInstance", "a2Soundscapes", "data", function ($scope, $modalInstance, a2Soundscapes, data) {
  $scope.soundscape = data.soundscape;
  $scope.region = data.region;
  $scope.data = {
    percent: 100
  };

  $scope.ok = function () {
    $scope.validation = {
      count: 0
    };
    var sdata = $scope.data,
        sval = $scope.validation;
    var vdata = {};
    var tst;

    if (sdata.percent > 100) {
      sval.percent = "Percent must be between 0% and 100%.";
      sval.count++;
    } else if ((sdata.percent * $scope.region.count | 0) < 1) {
      sval.percent = "You must sample at least 1 recording.";
      sval.count++;
    } else {
      vdata.percent = sdata.percent;
    }

    $scope.form_data = vdata;

    if (sval.count === 0) {
      a2Soundscapes.sampleRegion($scope.soundscape, $scope.region.id, vdata, function (region) {
        $modalInstance.close(region);
      });
    }
  };
}]);