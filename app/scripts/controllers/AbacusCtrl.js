'use strict';

/**
 * @ngdoc function
 * @name abacuApp.controller:AbacusCtrl
 * @description
 * # AbacusCtrl
 * Controller of the abacuApp
 */
angular.module('abacuApp')
  .constant('REFRESH_WARNING_TEXT', "Please Make sure you save your design before refreshing the page!")
  .controller('AbacusCtrl', ['$scope', '$location', 'localJSONStorage', '$routeParams', 'FrameData', 'User', 'Angles', 'Units', 'Drop', 'Design', '_', '$q', 'ngDialog', 'Errors', 'DownloadPDF', 'REFRESH_WARNING_TEXT',
    function ($scope, $location, localJSONStorage, $routeParams, FrameData, User, Angles, Units, Drop, Design, _, $q, ngDialog, Errors, DownloadPDF, REFRESH_WARNING_TEXT) {

      Drop.setFalse();
      /*********************Enums*******************************/
      //The visitation status for pages (parts/measures)
      var visitstatus = {
        VISITED: 'visited',
        UNVISITED: 'unvisited',
        CURRENT: 'current',
        Warning: 'warning'
      };

      //Indicates the current panel
      //ID = -1 indicates no panel open
      var curPanel = -1;
      var curColorPanel = -1;


      $scope.designIsSaved = true;

      $scope.saveDropdown = false;

      //The two states for pages to be in
      $scope.pageType = {
        CUSTOMIZE: 0,
        MEASURE: 1
      };


      $scope.MeasureTabs = {
        TUTORIAL: 'tutorial',
        ERGONOMICS: 'ergonomics',
        SUMMARY: 'summary'
      };

      //login panel
      $scope.loginModel = {
        email: '',
        password: ''
      };


      var loginPanelStatus = {
        MAIN:'main',
        LOGIN:'login',
        REGISTER:'register',
        SAVED:'saved',
        UPDATE:'update'
      };

      $scope.loginPanel = loginPanelStatus.MAIN;

      $scope.selectedColor = {};

      var grantAmount = 0;





      /**********************Main Variables****************************/



      $scope.left_button = 'arrow_left.png';
      $scope.right_button = 'arrow_right.png';
        //All the data about the current frame (loaded by init)
      $scope.curFrameData = null;

      //Arrays that store information about the pages
      var pages = {
        customizePages: [],
        measurePages: []
      };

      //The current part customization page
      var curPage = {
        page: [null, null], //has a current page for each page type
        type: $scope.pageType.CUSTOMIZE //keeps track of which page type we are currently looking at
      };

      //The current angle the wheelchair is being viewed from
      var curAngle = Angles.angleType.FRONTRIGHT;
      var measureTabs = $scope.MeasureTabs.TUTORIAL;

      //The current measurement system being used
      $scope.curUnitSys = User.getUnitSys();
      $scope.curUnit = null;



      $scope.unityToggle = function (){
        if ($scope.curUnit === true){
            $scope.curUnitSys = $scope.unitSysList[0].enumVal
        }
        if ($scope.curUnit === false) {
          $scope.curUnitSys = $scope.unitSysList[1].enumVal

        }
      }

      $scope.currChairIsNew = User.isNewWheelchair();

      $scope.downloadChairPDF = function () {
        var curChair = $scope.curEditWheelchair;
        DownloadPDF.forWheelchairs(new Design({wheelchair: curChair}))
        .catch(function (err) {
          alert('Failed to download Wheelchair PDF');
        });
      };

      /***************************Initialization****************************/

      //Generates the page arrays inside of pages
      function generatePages() {

        //part customization pages generation
        for (var i = 0; i < $scope.curFrameData.parts.length; i++) {
          var partID = $scope.curFrameData.parts[i].partID
          var optionIndexC = $scope.curEditWheelchair.getOptionIDForPart(partID)
          if(optionIndexC === -1) {
            var pPage = {index: i, partID: partID, visitstatus: visitstatus.UNVISITED};
            pages.customizePages.push(pPage);
          }
          else {
            var pPage = {index: i, partID: partID, visitstatus: visitstatus.VISITED};
            pages.customizePages.push(pPage);
          }
        }

        //measure pages generation
        for (var j = 0; j < $scope.curFrameData.measures.length; j++) {
          var mPage = {
            index: j,
            measureID: $scope.curFrameData.measures[j].measureID,
            visitstatus: visitstatus.UNVISITED
          };
          var optionIndex = $scope.curEditWheelchair.getOptionIndexForMeasure(mPage.measureID);
          if(optionIndex !== -1)
            mPage.visitstatus = visitstatus.VISITED;
          pages.measurePages.push(mPage);
        }

        //set our current pages to the beginning
        curPage.page[$scope.pageType.CUSTOMIZE] = pages.customizePages[0];
        curPage.page[$scope.pageType.MEASURE] = pages.measurePages[0];

        var partID = pages.customizePages[0].partID;
        if(partID) {
          var part = $scope.curFrameData.getPart(partID);
          var id = $scope.curEditWheelchair.getOptionIDForPart(partID)
          $scope.curOption = part.getOption(id);
          curColorPanel = id;
        }
      }

      // design is locked if it is part of the users order history
      function designIsLocked(design) {
        var designID = _.isString(design) ? design : design._id;

        var sentOrders = User.getSentOrders();
        return sentOrders.some(function (order) {
          return order.wheelchairs.some(function (lockedDesign) {
            return lockedDesign._id === designID || _.isEqual(lockedDesign, design);
          });
        });
      }

      //Initialize the page - called on pageLoad
      function init() {
        var initCurrentWheelchair = function (chair) {
          $scope.curEditWheelchair = chair;
          //Load data about the frame type of curEditWheelchair
          $scope.curFrameData = FrameData.getFrame($scope.curEditWheelchair.getFrameID());
          $scope.curOption = $scope.getCurPartData().getDefaultOption();
          generatePages();
        };

        var id = $routeParams.param1;

        if(id != null && id != 'grant') {
          if (designIsLocked(id)) {
            ngDialog.open({
              template: "views/modals/lockedDesignModal.html",
              controller: "LockedDesignModalCtrl"
            }).closePromise
            .then(function (result) {
              if (result.value === 'copy') {
                return User.fetchDesign(id)
                  .then(function (design) {
                    var cloneDesign = design.clone();
                    User.createCurrentDesign(cloneDesign);
                    initCurrentWheelchair(cloneDesign.wheelchair);
                  });
              } else {
                $location.path('/frames')
              }
            });
          } else {
            User.fetchDesign(id)
            .then(function (design) {
              User.createCurrentDesign(design);
              initCurrentWheelchair(design.wheelchair);
            })
            .catch(function (err) {
              console.log(err);
            });
          }
        } else if(id == 'grant'){
          User.createCurrentDesign(25);
          ngDialog.open({
            template: "views/modals/grantModal.html",
            scope: $scope
          }).closePromise
            .then(function(val){
              User.getCurEditWheelchair().setGrantAmount(val.value);
              grantAmount = val.value;
            })
        }

        //Send the user back to Frames if no curEditWheelchair set
        $scope.curEditWheelchair = User.getCurEditWheelchair();
        if ($scope.curEditWheelchair === null) {
          $location.path('/frames');
          return;
        }

        grantAmount = $scope.curEditWheelchair.getGrantAmount();

        //Load data about the frame type of curEditWheelchair
        $scope.curFrameData = FrameData.getFrame($scope.curEditWheelchair.getFrameID());
        generatePages();

        // Warn user before they reload the page to save their changes
        window.onbeforeunload = function () {
          return REFRESH_WARNING_TEXT;
        };


      }

      init(); //Initialize the page

      /******login action group*******/
      $scope.login = function () {
        $scope.loginText = 'Loading..';
        $scope.loginError = '';
        User.login($scope.loginModel.email, $scope.loginModel.password)
          .then(function () {
            $scope.loginText = 'Log In';
            $scope.loginModel.email = '';
            $scope.saveForLater();
            $scope.loginPanel = loginPanelStatus.SAVED;
          }, function (message) {
            $scope.loginText = 'Log In';
            $scope.loginError = message;
          });
        $scope.loginModel.password = '';
      };

      $scope.register = function(){
        $scope.loginPanel = loginPanelStatus.REGISTER;
      };

      $scope.enterLogin = function(keyEvent){
        if (keyEvent.which === 13){
          $scope.login();
        }
      };

      //register group
      $scope.registerAction = function(){
        $scope.error = '';
        $http({
          url: '/register'
          , data: $scope.accountModel
          , method: 'POST'
        }).success(function (data) {
          console.log(data);
          if(data.err) {
            $scope.error = data.err;
            if(data.field === 'password'){
              $scope.accountModel.password = '';
              $scope.accountModel.confirm = '';
            }
            else
            if(data.field === 'email'){
              $scope.accountModel.email = '';
            }
          }
          else {
            User.login($scope.accountModel.email, $scope.accountModel.password);
          }
        })
          .error(function (data) {
            console.log('Request Failed: ' + data);
            deferred.reject('Error loading user data');
          });

      };

      $scope.saveMessage = function(){
        User.setContentSection('measurements'); // set content section for my account page
        $location.path('/settings').search({section: 'myDesigns'});
      };

      //redirect
      $scope.backToMain = function(){
        $scope.loginPanel = loginPanelStatus.MAIN;
      };

      $scope.backToLogin = function(){
        $scope.loginPanel = loginPanelStatus.LOGIN;
      };

      $scope.backToMain = function(){
        $scope.loginPanel = loginPanelStatus.MAIN;
      };

      /****************Weight and Price******************/

      $scope.getTotalWeight = function () {
        return $scope.curEditWheelchair.getTotalWeight();
      };

      $scope.getTotalPrice = function () {
        return $scope.curEditWheelchair.getTotalPriceForAbacusCtrl() - grantAmount;
      };

      /*******************Unit Systems ****************************/

        //Options for the Unit System Drop-Down-List
        //set default to imperial
      $scope.unitSysList = [
        {
          name: 'Metric',
          enumVal: Units.unitSys.METRIC
        },
        {
          name: 'Imperial',
          enumVal: Units.unitSys.IMPERIAL
        }];

      if($scope.curUnitSys === $scope.unitSysList[0].enumVal){
        $scope.curUnit = false;
      }else {
        $scope.curUnit =true;}

      //Returns the appropriate weight unit name
      $scope.getCurUnitSysWeightName = function () {
        return Units.getWeightName($scope.curUnitSys);
      };

      //Returns the factor used to convert from lbs to given weight unit
      $scope.getCurUnitSysWeightFactor = function () {
        return Units.getWeightFactor($scope.curUnitSys);
      };

      /*******************Wheelchair Preview & Rotation***********************/

        //Returns an array of images for User.getCurEditWheelchair() sorted by zRank
      $scope.getPreviewImages = function () {
        return $scope.curEditWheelchair.getPreviewImages(curAngle);
      };


      //Changes curAngle based on dir (dir = +-1)
      $scope.rotatePreview = function (dir) {
        curAngle = curAngle + dir;
        if (curAngle < 0) {
          curAngle = Angles.numAngles - 1;
        }
        if (curAngle >= Angles.numAngles) {
          curAngle = 0;
        }
      };

      /****************Page Functions******************/

      //return array of current page objects
      $scope.getCurPages = function () {

        if (curPage.type === $scope.pageType.CUSTOMIZE) {
          return pages.customizePages;
        }
        return pages.measurePages;
        //.concat(pages.customizePages);
      };

      //return array of customize page
      $scope.getCustomizePages = function () {
        return pages.customizePages;
      };
      $scope.getMeasurePages = function () {
        return pages.measurePages;
      };

      $scope.getCurPage = function () {
        return curPage.page[curPage.type];
      };
      $scope.getCurCustomizePage = function () {
        return curPage.page[$scope.pageType.CUSTOMIZE];
      };
      $scope.getCurMeasurePage = function () {
        return curPage.page[$scope.pageType.MEASURE];
      };

      $scope.getCurPageType = function () {
        return curPage.type;
      };

      $scope.isInMPage = function (){
        return $scope.getCurPageType() == $scope.pageType.MEASURE;
      };

      //Returns the current part from curFrameData based on curPage.page[CUSTOMIZE].ID
      $scope.getCurPartData = function () {
        return $scope.curFrameData.getPart($scope.getCurCustomizePage().partID);
      };

      //Returns the current part from curEditWheelchair based on curPage.page[CUSTOMIZE].ID
      $scope.getCurWheelchairPart = function () {
        return $scope.curEditWheelchair.getPart($scope.getCurCustomizePage().partID);
      };

      //Returns the current measure from curFrameData based on curPage.page[MEASURE].ID
      $scope.getCurMeasureData = function () {
        return $scope.curFrameData.getMeasure($scope.getCurMeasurePage().measureID);
      };

      //Returns the current measure from curEditWheelchair based on curPage.page[MEASURE].ID
      $scope.getCurWheelchairMeasure = function () {
        return $scope.curEditWheelchair.getMeasure($scope.getCurMeasurePage().measureID);
      };

      $scope.setCurPageType = function (newType) {
        curPage.type = newType;
        $scope.curOption = {};
      };

      $scope.setCurPage = function (newIndex) {
        curPage.page[curPage.type] = $scope.getCurPages()[newIndex];
      };
      $scope.setCurCustomizePage = function (newIndex) {
        curPage.page[$scope.pageType.CUSTOMIZE] = pages.customizePages[newIndex];
      };
      $scope.setCurMeasurePage = function (newIndex) {
        curPage.page[$scope.pageType.MEASURE] = pages.measurePages[newIndex];
      };





      /****************Measure Carousel****************/

        //The current index of the image shown in the Measure Carousel
      $scope.curMeasureCarouselIndex = 0;

      function resetSelectedMeasureImageIndex() {
        $scope.curMeasureCarouselIndex = 0;
      }


      //Cycles the carousel in the direction of dir (+-1)
      $scope.rotateMeasureCarouselIndex = function (dir) {
        var len = $scope.getCurMeasureData().getNumImages();
        $scope.curMeasureCarouselIndex += dir;
        if ($scope.curMeasureCarouselIndex >= len) {
          $scope.curMeasureCarouselIndex = 0;
        }
        else if ($scope.curMeasureCarouselIndex < 0) {
          $scope.curMeasureCarouselIndex = len - 1;
        }
      };

      //Directly jumps the carousel to the given index
      $scope.jumpMeasureCarouselIndex = function (index) {
        $scope.curMeasureCarouselIndex = index;
      };


      /*************measurement page tab switch  ******/

      $scope.getMeasureTabs = function () {
        return measureTabs;
      };

      $scope.setMeasureTabs = function (newSection) {
        measureTabs = newSection;
      };


      /****************ProgressBar******************/
      // initialize $scope.curOption
      function setColor(){
        var partID = $scope.getCurPage().partID;
        if(partID) {
          $scope.designIsSaved = false;
          var part = $scope.curFrameData.getPart(partID);
          var id = $scope.curEditWheelchair.getOptionIDForPart(partID)
          $scope.curOption = part.getOption(id);
          curColorPanel = id;
        }else{
          $scope.designIsSaved = false;
          curColorPanel = -1;
          $scope.curOption = {};
        }
      }


        //Switches pages left/right based on dir
      $scope.pageSwitchStep = function (dir) {
        if ($scope.getCurPageType() === $scope.pageType.MEASURE && dir === -1 && $scope.getCurPage().index === 0) {
          $scope.setCurPageType($scope.pageType.CUSTOMIZE);
          //set to customize
          $scope.getCurPage().visitstatus = visitstatus.VISITED;
          $scope.setCurPage(pages.customizePages.length - 1);
        }
        else if ($scope.getCurPageType() === $scope.pageType.CUSTOMIZE && dir === 1 && $scope.getCurPage().index === pages.customizePages.length - 1) {
          $scope.setCurPageType($scope.pageType.MEASURE);
          //set to measure

          if($scope.getCurWheelchairMeasure().measureOptionIndex !== -1)
            $scope.getCurPage().visitstatus = visitstatus.VISITED;
          else
            $scope.getCurPage().visitstatus = visitstatus.UNVISITED;
          $scope.setCurPage(0);
        }
        else {
          if($scope.getCurWheelchairMeasure().measureOptionIndex !== -1 || $scope.getCurPageType() === $scope.pageType.CUSTOMIZE)
            $scope.getCurPage().visitstatus = visitstatus.VISITED;
          else
            $scope.getCurPage().visitstatus = visitstatus.UNVISITED;
          $scope.setCurPage($scope.getCurPage().index + dir);
        }
        $scope.getCurPage().visitstatus = visitstatus.CURRENT;
        $scope.closeAllPanels();
        resetSelectedMeasureImageIndex();
        navigateArrows(dir);
        $scope.setMeasureTabs($scope.MeasureTabs.TUTORIAL);

        // initial $scope.curOption after page jump
       setColor();
      };




      //Jump to the given page
      $scope.pageSwitchJump = function (page) {
        if($scope.getCurWheelchairMeasure().measureOptionIndex !== -1 || $scope.getCurPageType() === $scope.pageType.CUSTOMIZE)
          $scope.getCurPage().visitstatus = visitstatus.VISITED;
        else
          $scope.getCurPage().visitstatus = visitstatus.UNVISITED;  //set current page to visit status: visited
        $scope.setCurPage(page.index); //set new current page
        $scope.getCurPage().visitstatus = visitstatus.CURRENT;
          //set new current page to visit status : current
        $scope.closeAllPanels(); //close any panels we may have opened
        if ($scope.getCurPageType() === $scope.pageType.MEASURE) { //resets the selected image in the measure panel
          resetSelectedMeasureImageIndex();
          $scope.setMeasureTabs($scope.MeasureTabs.TUTORIAL);
        }
        setColor()
      };

      //Returns the image for the given progress bar segment based on visit status and index
      $scope.getProgBarImage = function (page) {
        if (page.index === 0) {
          if (page.visitstatus === visitstatus.UNVISITED) {
            return ('images/progress_bar/progress_bar_front_link.png');
          }
          if (page.visitstatus === visitstatus.VISITED) {
            return ('images/progress_bar/progress_bar_front_visited.png');
          }
          if (page.visitstatus === visitstatus.CURRENT) {
            return ('images/progress_bar/progress_bar_front_clicked.png');
          }
        }
        else {
          if (page.visitstatus === visitstatus.UNVISITED) {
            return ('images/progress_bar/progress_bar_link.png');
          }
          if (page.visitstatus === visitstatus.VISITED) {
            return ('images/progress_bar/progress_bar_visited.png');
          }
          if (page.visitstatus === visitstatus.CURRENT) {
            return ('images/progress_bar/progress_bar_clicked.png');
          }
        }
      };

      //Causes a progressBar segment's tooltip to be visible
      $scope.progressSegmentHoverIn = function () {
        this.showProgressSegmentTooltip = true;
      };

      //Causes a progressBar segment's tooltip to be invisible
      $scope.progressSegmentHoverOut = function () {
        this.showProgressSegmentTooltip = false;
      };

      //Determine the text for each tooltip to display
      $scope.getProgressBarSegmentTooltipText = function (page) {
        if (curPage.type === $scope.pageType.CUSTOMIZE) {
          return $scope.curEditWheelchair.getPartDetails(page.partID, 0).partName;
        }
        else if (curPage.type === $scope.pageType.MEASURE) {
          return $scope.curEditWheelchair.getMeasureDetails(page.measureID, 0).name;
        }
        return 'ERROR: Invalid page type';
      };

      $scope.getCustomizeTooltipText = function (page){
           return $scope.curEditWheelchair.getPartDetails(page.partID, 0).partName;
      };

      $scope.getMeasurementTooltipText = function (page){
          return $scope.curEditWheelchair.getMeasureDetails(page.measureID, 0).name;
      };

      /*********Save $ review Dropdown*********/


      $scope.saveDropDown = function() {
        $scope.saveDropdown = true;
        console.log('im opening')
      };

      $scope.closeSaveDropDown = function () {
        $scope.saveDropdown = false;
        $scope.loginPanel = loginPanelStatus.MAIN;
        $scope.loginError = '';
      };


      /****complete check function ***/

      //complete check on HTML
      $scope.completed = function() {
        for(var i=0; i<pages.measurePages.length; i++){
          var optionIndexM = $scope.curEditWheelchair.getOptionIndexForMeasure(pages.measurePages[i].measureID);
          if (optionIndexM === -1){
            return pages.measurePages[i];
          }
        }
        return null;
      };

      $scope.completedC = function() {
        for(var i=0; i<pages.customizePages.length; i++) {
          var optionIndexC = $scope.curEditWheelchair.getOptionIDForPart(pages.customizePages[i].partID);
          if (optionIndexC === -1) {
            return pages.customizePages[i];
          }
        }

        return null;
      };

      //Complete check for save to design function:  Return null if all measures are set, otherwise return page for first unset measure
      $scope.completedCheck = function() {
        var unfinishedPages = [];
        for(var i=0; i<pages.measurePages.length; i++){
          var optionIndexM = $scope.curEditWheelchair.getOptionIndexForMeasure(pages.measurePages[i].measureID);

          if(optionIndexM === -1){
            unfinishedPages.push(pages.measurePages[i]);
          }
        }

        for(var i = 0; i < unfinishedPages.length; i++){
          unfinishedPages[i].visitstatus = visitstatus.CURRENT
        }
        return unfinishedPages;
      };

      $scope.completePercentage = function (){
        var completeNum = ($scope.completedCheck()).length;
        var total = pages.customizePages.length + pages.measurePages.length;
        return Math.round((total - completeNum) / total * 100);
      };


      /*****************Sidebar Tabs***************/

      $scope.switchPageType = function (newPageType) {
        $scope.closeAllPanels();
        $scope.setCurPageType(newPageType);
        $scope.getCurPage().visitstatus = visitstatus.CURRENT;
      };

      /************Color panel function***********/
      //hide color option for special parts
      $scope.hideColor = function(optionID){
        var partID = $scope.getCurPartData().partID;
        var id = optionID;
        if((id !== 3100) && (id !== 11200) &&( partID !== 4000 ))
          return true;
        else
          return false;
      };

      /*****************Building CurWheelchair*****/

      $scope.curChairHasOption = function (optionID) {
        var option = _.find($scope.curEditWheelchair.parts, {'optionID': optionID});
        return !_.isUndefined(option);
      };

      $scope.setCurOption = function (newOptionID) {

        var curPartID = $scope.getCurPartData().partID;

        if($scope.curEditWheelchair.getPart(curPartID).optionID == newOptionID){
          return
        }

        $scope.curEditWheelchair.setOptionForPart(curPartID, newOptionID);

        //sync colors between parts
        if(newOptionID == 2300 || newOptionID ==2100){
          if($scope.curEditWheelchair.getPart(3000).optionID === 3100){
            var color = $scope.curEditWheelchair.getPart(1000).colorID;
            $scope.curEditWheelchair.setColorForPart(3000, color);
          }
        }
        if(newOptionID == 11200){
          var color = $scope.curEditWheelchair.getPart(3000).colorID;
          $scope.curEditWheelchair.setColorForPart(11000, color);
        }
        if(newOptionID == 3100){
          var color = $scope.curEditWheelchair.getPart(1000).colorID;
          $scope.curEditWheelchair.setColorForPart(3000, color);
        }
        if((newOptionID == 3100 || newOptionID == 3150 || newOptionID == 3200 || newOptionID == 3300) && (_.get($scope.curEditWheelchair.getPart(11000), 'optionID') === 11200)){
          var color = $scope.curEditWheelchair.getPart(3000).colorID;
          $scope.curEditWheelchair.setColorForPart(11000, color);
        }
        if((newOptionID == 2100) || (newOptionID == 2300)){
          var color = $scope.curEditWheelchair.getPart(1000).colorID;
          $scope.curEditWheelchair.setColorForPart(4000, color);
        }
        if((newOptionID == 4100) || (newOptionID == 4300) || (newOptionID == 4200) || (newOptionID == 4400) || (newOptionID == 4500) || (newOptionID == 4600)){
          var color = $scope.curEditWheelchair.getPart(1000).colorID;
          $scope.curEditWheelchair.setColorForPart(4000, color);
        }
        //if((newOptionID == 2100) || (newOptionID == 2300)){
        //    if($scope.curEditWheelchair.getPart(3000).colorIn == true){
        //      $scope.curEditWheelchair.setColorForPart(3000, newColorID);
        //      $scope.curEditWheelchair.setColorForPart(11000, newColorID);
        //    }
        //}
        if(newOptionID == 6100){
            // they just selected NONE as their option for wheels
            $scope.curEditWheelchair.setOptionForPart(7000, 7500);
            $scope.curEditWheelchair.setOptionForPart(8000, 8800);
        }
        if((newOptionID == 6200) || (newOptionID == 6300) || (newOptionID == 6400) || (newOptionID ==6500) || (newOptionID == 6600) || (newOptionID == 6700)){
            //They just elected a wheel, select the default hand rim and tire too
            if($scope.curEditWheelchair.getPart(7000).optionID === 7500){
                //there is currently no hand rim selected
                $scope.curEditWheelchair.setOptionForPart(7000, 7100);
            }
            if($scope.curEditWheelchair.getPart(8000).optionID === 8800){
                //there is currently no tire selected
                $scope.curEditWheelchair.setOptionForPart(8000, 8100);
            }
        }

        console.log('Changed option');

        setColor();
      };

      $scope.setCurMultiOption = function (newOptionID) {
        $scope.designIsSaved = false;
        $scope.curEditWheelchair.setMultiOptionForPart($scope.getCurPartData().partID, newOptionID);
      };

      $scope.setSelectedColor = function (colorObject) {
        $scope.designIsSaved = false;
        $scope.selectedColor = colorObject;
      };

      $scope.setCurOptionColor = function (newColorID) {
        $scope.designIsSaved = false;
        console.log($scope.getCurPanelID());
        if ($scope.getCurColorPanelID() !== $scope.getCurWheelchairPart().optionID) {
            $scope.setCurOption($scope.getCurPanelID());
        }
        $scope.curEditWheelchair.setColorForPart($scope.getCurWheelchairPart().partID, newColorID);
        $scope.curEditWheelchair.setColorIn($scope.getCurWheelchairPart().partID);

        var ID = $scope.getCurWheelchairPart().partID;

          if (($scope.curEditWheelchair.frameID >= 20) && ($scope.curEditWheelchair.frameID < 30))  {
           //update the linking color for the THunders
            if(ID == 1000 && ($scope.curEditWheelchair.getPart(3000).optionID == 3100)){
              $scope.curEditWheelchair.setColorForPart(3000, newColorID);
              $scope.curEditWheelchair.setColorForPart(11000, newColorID);

              $scope.curEditWheelchair.setColorForPart(2222, newColorID);
            }

            if (ID == 1000 && ($scope.curEditWheelchair.getPart(4000).colorIn == true)){
              $scope.curEditWheelchair.setColorForPart(4000, newColorID);
            }

            if(ID == 3000 && $scope.curEditWheelchair.getPart(11000).optionID === 11200){
              var color = $scope.curEditWheelchair.getPart(3000).colorID;
              $scope.curEditWheelchair.setColorForPart(11000, color);
            }
        }

        if (($scope.curEditWheelchair.frameID >= 10) && ($scope.curEditWheelchair.frameID < 20)) {
            //for the spinergy wheels
            if(ID == 1000 && ($scope.curEditWheelchair.getPart(2222).optionID == 2100)){
              $scope.curEditWheelchair.setColorForPart(2222, newColorID);
            }
        }

        console.log('Changed color option');
      };

      // setting color for parts that allows multiple color options
      $scope.setCurMultiOptionColor = function (optionID, newColorID) {
        $scope.designIsSaved = false;
        if ($scope.getCurPanelID() !== $scope.getCurWheelchairPart().optionID) {
            $scope.setCurMultiOption($scope.getCurPanelID());
        } $scope.curEditWheelchair.setColorForMultiPart($scope.getCurWheelchairPart().partID, optionID, newColorID);
        var ID = $scope.getCurWheelchairPart().partID
        if(ID == 1000){
          $scope.curEditWheelchair.setColorForPart(2000, newColorID);
          $scope.curEditWheelchair.setColorForPart(4000, newColorID);
          $scope.curEditWheelchair.setColorForPart(2222, newColorID);
        }
        console.log('Changed color option');
      };

      $scope.setCurOptionSize = function (newSizeIndex) {
        $scope.designIsSaved = false;
        if ($scope.getCurColorPanelID() !== $scope.getCurWheelchairPart().optionID) {
            $scope.setCurOption($scope.getCurPanelID());
        } $scope.curEditWheelchair.setSizeForPart($scope.getCurWheelchairPart().partID, newSizeIndex);  console.log('Changed size option');
      };

      $scope.removeMultiOptionPart = function (optionID) {
        $scope.designIsSaved = false;
        $scope.curEditWheelchair.removeMultiOption(optionID);
      };

      /*****************Panels*********************/
      //Sets curPanel to the chosen panel
      //Closes the panel if id and type match curPanel
      $scope.setPanel = function (id) {
        var partID = $scope.getCurPage().partID;
        var part = $scope.curFrameData.getPart(partID);
          if ($scope.isPanelSelected(id)) {
            curPanel = -1;
            if($scope.getCurPageType() === $scope.pageType.CUSTOMIZE) {
              var optionID = $scope.curEditWheelchair.getPart(partID).optionID;
              $scope.curOption = part.getOption(optionID);
            }
          }
          else {
            curPanel = id;
            $scope.curOption = part.getOption(id);
          }
          //console.log("set");
      };

      $scope.$watch('curOption.comments', function(oVal, nVal){
        console.log(nVal);
        $scope.designIsSaved = oVal === nVal;
        var partID = $scope.getCurPage().partID;
        if($scope.curOption.optionID == $scope.curEditWheelchair.getPart(partID).optionID){
          $scope.curEditWheelchair.getPart(partID).comments = nVal;
        }
      });


      //Closes any open panel
      $scope.closeAllPanels = function () {
        curPanel = -1;
        $scope.setPanel(-1);
        $scope.closeSaveDropDown();
      };

      //Check if the panel with the given id and type is selected
      $scope.isPanelSelected = function (id) {
        return (curPanel === id);
      };

      $scope.isColorPanelselected = function(id) {
        return(curColorPanel === id);
      }


      $scope.panelReset = function(){
        curPanel=-1;
        $scope.curOption = $scope.getCurPartData().getDefaultOption();
      };

      $scope.getCurPanelID = function () {
        return curPanel;
      };

      $scope.getCurColorPanelID = function() {
        return curColorPanel;
      };


      /*******************Sidebar Colors***************/

        //Returns true if the current option is selected and has color options
      $scope.isSidebarColored = function (optionID) {
        if (curPage.type !== $scope.pageType.CUSTOMIZE) {
          return;
        }

        var partID = $scope.getCurPage().partID;
        var part = $scope.curFrameData.getPart(partID);
        var option = part.getOption(optionID);
        var invalidPart = true;
        if (partID == 2000 && partID == 4000){
          invalidPart = false;
        }

        return $scope.curChairHasOption(optionID) && (option.getNumColors() > 0 && invalidPart);
      };

      //Returns a CSS-styled hex string for the given option
      //This should only be called if isSidebarColored returns true
      $scope.getSidebarColor = function (optionID) {
        if (curPage.type !== $scope.pageType.CUSTOMIZE) {
          return;
        }

        var partID = $scope.getCurPage().partID;
        var part = $scope.curFrameData.getPart(partID);
        var option = part.getOption(optionID);
        var wPart = $scope.curEditWheelchair.getPart(partID);
        return option.getColor(wPart.colorID).getHexString();
      };

      /*******************Saving***********************/

        //Saves the current design and updates the database if the user is logged in
      $scope.saveDesign = function () {
        User.pushNewWheelchair()
        .then(function (user) {
          $scope.designIsSaved = true;
          $location.path('/cart');
        });
      };

      /*******************Sharing***********************/

      // Creates a design from the current wheelchair configuration and saves it in the DB (must be logged in)
      //
      function generateDesignIDForCurrentChair() {
        var design = User.getCurEditWheelchairDesign();

        if (_.isNull(design)) {
          design = new Design({
            'creator': User.getID(),
            'wheelchair': $scope.curEditWheelchair
          });
        }

        design.wheelchair = $scope.curEditWheelchair;

        // If the design doesn't have an ID, generate one by saving it to the backend
        var designPromise = design.hasID() ? User.updateDesign(design) : User.saveDesign(design);

        return designPromise;
      }

      // share design function in tinker page
      $scope.shareDesignID = function () {
        generateDesignIDForCurrentChair()
        .then(function (design) {
          $scope.modalDesign = design;
          User.createCurrentDesign(design);
          return ngDialog.open({
            'template': 'views/modals/designIDModal.html',
            'scope': $scope
          })
          .closePromise;
        })
        .then(function () {
          $scope.modalDesign = null;
          $scope.designIsSaved = true;
        })
        .catch(function (err) {
          if (err instanceof Errors.NotLoggedInError) {
            ngDialog.open({
              'template': 'views/modals/loginPromptModal.html',
              'scope': $scope
            }).closePromise
            .then(function(){
              // return Drop.setTrue();
            });
          }
        });
      };

      $scope.loginPanelDrop = function(){
        Drop.setTrue();
      };

      /*********************Saving For Later*********************/

      // save the current wheelchair to the wishlist and make sure its not the currently editing wheelchair anymore
      $scope.saveForLater = function () {
        //check if user has login
        if (!User.isLoggedIn()) {
          $scope.loginPanel = loginPanelStatus.LOGIN;
        }
        else {
          var design = User.getCurEditWheelchairDesign();

          if (_.isNull(design)) {
            design = new Design({
              'creator': User.getID(),
              'wheelchair': $scope.curEditWheelchair
            });
          }

          design.wheelchair = $scope.curEditWheelchair;

          var designPromise = null;
          if (design.hasID()) {
            // prompt if they want to create a copy or overwrite
            designPromise = ngDialog.open({
              'template': 'views/modals/saveDesignMethodModal.html',
              'scope': $scope
            })
            .closePromise
            .then(function (saveMethod) {
              // can either choose to create a copy, or overwrite the existing design in the DB
              switch (saveMethod.value) {
                case 'copy': {
                  delete design._id; // remove the id
                  design.creator = User.getID();
                  return User.saveDesign(design);
                }
                // overwrite the existing design
                case 'overwrite': {
                  if (User.getID() === design.creator || User.isAdmin()) {
                    return User.updateDesign(design)
                      .then(function (updatedDesign) {
                        // Replace cart Item with newest version of chair
                        var userCart = User.getCart();
                        userCart.wheelchairs = userCart.wheelchairs.map(function (design) {
                          design = design._id == updatedDesign._id ? updatedDesign : design;
                          return design;
                        });

                        return updatedDesign;
                      });
                  } else {
                    return ngDialog.open({
                      'template': '<div style="text-align: center;"><h2>Sorry, you can\'t overwrite this design</h2></div>',
                      'plain': true
                    })
                    .closePromise
                    .then(_.constant(null));
                  }
                  break;
                }
              }
            });
          } else {
            // just go ahead and save the design to the DB, its new anyways
            designPromise = User.saveDesign(design);
          }

          if (designPromise) {
            designPromise
            .then(function (design) {
              if (design instanceof Design) {
                return User.addDesignIDToSavedDesigns(design._id);
              }
            })
            .then(function (updatedUserData) {
              if (updatedUserData) { // only show Saved dialog if a user update was made
                $scope.designIsSaved = true;
                $scope.loginPanel = loginPanelStatus.SAVED;
              }
            })
            .catch(function (err) {
              console.log(err);
              ngDialog.open({
                //TODO: design and incorporate error message
                'template': '<div><h2>Oops! An Error Occurred</h2></div>',
                'plain': true
              });
            });
          }
        }
      };

      /*****************General Use Functions*********************/

        //Trims a string with an ellipsis if it is longer than len
      $scope.ellipsisFormat = function (str, len) {
        if (str.length > len) {
          return str.substring(0, len) + '...';
        }
        else {
          return str;
        }
      };

      //returns the full string for the title, but only if necessary   ( similar to ellipsisFormat() )
      $scope.titleForEllipsis = function (str, len) {
        if (str.length > len) {
          return str;
        }
        else {
          return '';
        }
      };

      angular.element($(window)).bind('resize', function() {
        $scope.$apply();
      });

      $scope.screenWideQuery = function(){
        var width = $(window).width();
        var height = $(window). height();
        return 0.463*(width-330) > 0.9*(height-140);
      };

      $scope.nothing = function(){
        return
      };

      $scope.measureChanged = function(){
        measureChanged();
        calcCompleteness();
      };
      // $scope.$on('$viewContentLoaded', _.once(function() {
      //     initNavBar();
      // }));

      $scope.initNavBar = _.once(initNavBar);

      $scope.$watch('curEditWheelchair', function (oldVal, newVal) {
        console.log('change for curEditWheelchair');
        console.log([oldVal, newVal]);
      });

      $scope.$on('$destroy', function () {
        window.onbeforeunload = null;
      });

      function getBaseURL() {
        var absUrl = $location.absUrl();
        var path = $location.url();
        var baseUrl = _.trimEnd(absUrl, path);
        return baseUrl;
      }

      // This code is from: http://weblogs.asp.net/dwahlin/cancelling-route-navigation-in-angularjs-controllers
      var onRouteChangeOff = $scope.$on('$locationChangeStart', function (event, newUrl) {

        if ($scope.designIsSaved) {
          return; // let the navigation happen, chair is already saved
        }

        ngDialog.open({
          template: 'views/modals/saveDesignModal.html'
        }).closePromise
          .then(function (result) {
            if (result.value === 'continue') {
              onRouteChangeOff();

              var baseURL = getBaseURL();
              var newPath = newUrl.replace(baseURL, '');
              $location.url(newPath);
            }
          });

        //prevent navigation by default since we'll handle it
        //once the user selects a dialog option
        event.preventDefault();
      });




    }]);
