'use strict';

/**
 * @ngdoc function
 * @name abacuApp.controller:FrameCtrl
 * @description
 * # FrameCtrl
 * Controller of the abacuApp
 */
angular.module('abacuApp')
  .controller('FrameCtrl', ['$scope', '$location', 'FrameData', 'User', 'Units', 'Drop',
    function ($scope, $location, FrameData, User, Units, Drop) {

      Drop.setFalse();
      //An array of all Frames
      $scope.frames = FrameData.getFrames();
      $scope.detailPanel = false;

      $scope.orientation = 'vertical'; //change to vertical
      //Create a new Wheelchair of the chosen frame type and send the user to Abacus with it
      $scope.selectFrame = function (frameID) {
        //Create a new wheelchair and set is as curEditWheelchair
        User.createCurrentDesign(frameID);

        //Send the user to Abacus
        $location.path('/tinker');
      };

      $scope.toggleDetail = function(){
        $scope.detailPanel = !$scope.detailPanel;
      };





      //Determines if the given frame picture is being hovered over
      $scope.panelSelected = function (hoverItem, frameID) {
        return (hoverItem === frameID);
      };

      //Returns a display-formatted string of the baseWeight of the given frame
      $scope.getWeightString = function (frame) {
        return (frame.getBaseWeight() * Units.getWeightFactor(User.getUnitSys())).toFixed(2) + ' ' + Units.getWeightName(User.getUnitSys());
      };

      $scope.setOrientation = function(orientation){
          $scope.orientation = orientation;
      }

      $scope.getOrientation = function(){
        return $scope.orientation;
      }

    }]);
