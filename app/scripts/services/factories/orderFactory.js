'use strict';

/**
 * @ngdoc function
 * @name abacuApp.static factory:orderFactory
 * @description
 * # orderFactory
 * Service of the abacuApp
 */

/*
 * This factory produces Order objects
 * An Order is a collection of designed wheelchairs and user data to be sent to the distributor
 * An Order is "sent" if it has a date set for sentDate - it is "unsent" if sentDate is null
 * User contains an array of Orders
 * User also keeps track of one unsent Order, which is used as the cart
 * Order contains various aggregation functions which calculate the subtotal, shipping fee, tax, and total costs
 * Order has a function send() which accepts finalized user data and sends itself to the distributor, marking itself as sent
 * Orders can be constructed directly from a JSON object using the Order.fromJSONData() function
 */
angular.module('abacuApp')
  .factory('Order', ['$q', '$http', 'Wheelchair', 'localJSONStorage', 'Design', function ($q, $http, Wheelchair, localJSONStorage, Design) {

    function Order(taxRate, shippingFee, order) {
      this.wheelchairs = [];
      if (order == null) {
        this._id = -1;
        this._rev = null;
        this.orderNum = 'OrderNumNotSet';
        this.taxRate = taxRate;
        this.shippingFee = shippingFee;
        this.sentDate = null; //null = "unsent"

        this.userID = -1;
        this.fName = '';
        this.lName = '';
        this.email = '';
        this.phone = '';
        this.addr = '';
        this.addr2 = '';
        this.city = '';
        this.state = '';
        this.zip = '';

        this.payMethod = '';
      }
      else {
        this._id = order._id || order.id  || -1;
        this._rev = order._rev || order.rev || null;
        this.orderNum = order.orderNum;
        this.taxRate = order.taxRate;
        this.shippingFee = order.shippingFee;
        this.sentDate = new Date(order.sentDate);
        this.userID = order.userID;
        this.fName = order.fName;
        this.lName = order.lName;
        this.email = order.email;
        this.phone = order.phone;
        this.addr = order.addr;
        this.addr2 = order.addr2;
        this.city = order.city;
        this.state = order.state;
        this.zip = order.zip;
        this.payMethod = order.payMethod;

        this.wheelchairs = order.wheelchairs.map(function (wheelchairDesign) {
          return new Design(wheelchairDesign);
        });
      }
    }


    function updateOrderCookie (orderInfo, wheelchairs) {
      localJSONStorage.put('cartInfo', orderInfo);
      var tempWheelchairs = [];
      for (var i = 0; i < wheelchairs.length; i++) {
        tempWheelchairs.push(wheelchairs[i].allDetails());
      }
      localJSONStorage.put('cartWheelchairs', tempWheelchairs);
    }

    Order.prototype = {

      addWheelchair: function (newWheelchair) {
        this.wheelchairs.push(newWheelchair);
      },

      removeWheelchair: function (index) {
        if (index >= 0 && index < this.wheelchairs.length) {
          this.wheelchairs[index].toggleInOrder();
          return this.wheelchairs.splice(index, 1);
        }
        return null;
      },

      //**************gets/sets************/

      getAll: function () {
        var details = {
          orderNum: this.orderNum,
          taxRate: this.taxRate,
          shippingFee: this.shippingFee,
          sentDate: this.sentDate,
          userID: this.userID,
          fName: this.fName,
          lName: this.lName,
          email: this.email,
          phone: this.phone,
          addr: this.addr,
          addr2: this.addr2,
          city: this.city,
          state: this.state,
          zip: this.zip,
          paymethod: this.paymethod,
          wheelchairs: this.wheelchairs.map(function (w) {
            return w.allDetails();
          })
        };

        if (this._id && this._id !== -1) {
          details._id = this._id;
        }

        if (this._rev) { // only attach _rev if it exists
          details._rev = this._rev;
        }

        return details;
      },

      getOrderInfo: function () {
        return {
          orderNum: this.orderNum,
          taxRate: this.taxRate,
          shippingFee: this.shippingFee,
          sentDate: this.sentDate,
          userID: this.userID,
          fName: this.fName,
          lName: this.lName,
          email: this.email,
          phone: this.phone,
          addr: this.addr,
          addr2: this.addr2,
          city: this.city,
          state: this.state,
          zip: this.zip,
          paymethod: this.paymethod,
          wheelchairs: this.wheelchairs.map(function (w) {
            return w.allDetails();
          })
        };
      },


      getPayMethod: function () {
        return this.payMethod;
      },
      getTaxRate: function () {
        return this.taxRate;
      },
      getShippingFee: function () {
        return this.shippingFee;
      },
      getOrderNum: function () {
        return this.orderNum;
      },
      getWheelchairs: function () {
        return this.wheelchairs;
      },
      getNumWheelchairs: function () {
        return this.wheelchairs.length;
      },
      getSentDate: function () {
        return this.sentDate;
      },
      getUserID: function () {
        return this.userID;
      },
      getFname: function () {
        return this.fName;
      },
      getLname: function () {
        return this.lName;
      },
      getEmail: function () {
        return this.email;
      },
      getPhone: function () {
        return this.phone;
      },
      getAddr: function () {
        return this.addr;
      },
      getAddr2: function () {
        return this.addr2;
      },
      getCity: function () {
        return this.city;
      },
      getState: function () {
        return this.state;
      },
      getZip: function () {
        return this.zip;
      },

      getFullName: function () {
        return this.fName + ' ' + this.lName;
      },
      getFullAddr: function () {
        var a2 = this.addr2;
        if (this.addr2 !== '')
          a2 = ' ' + a2;
        return this.addr + a2;
      },

      getFormattedAddr: function () {
        var fullAddr = this.addr;
        if (this.addr2 !== '') {
          fullAddr += '<br>' + this.addr2;
        }
        fullAddr += '<br>' + this.city + ', ' + this.state + ', ' + this.zip;
        return fullAddr;
      },

      //The Order is "sent" if sentDate is non-null
      hasBeenSent: function () {
        return this.sentDate !== null;
      },

      getWheelchair: function (index) {
        if (index >= 0 && index < this.wheelchairs.length)
          return this.wheelchairs[index].wheelchair;
        return null;
      },

      getAllWheelchair: function () {
      return this.wheelchairs;
    },

      /*****************Cost Calculators (Aggregate Functions)****************/

      //The combined cost of all the Wheelchairs in the Order
      getSubtotal: function () {
        if (this.wheelchairs.length > 0) {
          var total = 0;
          for (var i = 0; i < this.wheelchairs.length; i++) {
            total += this.wheelchairs[i].wheelchair.getTotalPrice();
          }
          return total;
        }
        return 0;
      },

      //The estimated cost of shipping this Order
      getShippingCost: function () {
        return this.getShippingFee() * this.getNumWheelchairs();
      },

      //The Tax to be paid for this Order
      getTaxCost: function () {
        return this.getSubtotal() * this.getTaxRate();
      },

      //The sum of Subtotal, Shipping Cost, and Tax Cost
      getTotalCost: function () {
        return this.getSubtotal() + this.getShippingCost() + this.getTaxCost();
      },

      /********************Saving to DB***********************/

      //This asyncronous funtion takes in various user information
      //and sends the Order to the distibutor with it.
      //This method also saves the Order to the database and marks it as "sent"
      send: function (userID, userData, shippingData, payMethod, token) {
        var deferred = $q.defer();

        //Need a reference to the current scope when inside the callback function
        var curThis = this;

        //Save userData, shippingData, and payMethod into Order
        this.userID = userID;
        this.fName = userData.fName;
        this.lName = userData.lName;
        this.email = userData.email;
        this.phone = userData.phone;
        this.addr = shippingData.addr;
        this.addr2 = shippingData.addr2;
        this.city = shippingData.city;
        this.state = shippingData.state;
        this.zip = shippingData.zip;
        this.payMethod = payMethod;
        this.sentDate = new Date(); //Set date to now - doing this marks this Order as "sent"
        $http   ({
          url: '/order',
          data: {order: this.getAll(), token: token},
          method: 'POST'
        }).success(function(data){
          console.log(data);
          if(!data.err)
            curThis.orderNum = data;
          else {
            curThis.orderNum = -1;
            alert('error processing order:'+ data.err);
          }
          for(var i=0; i<curThis.wheelchairs.length; i++)
            curThis.wheelchairs[i].wheelchair.toggleInOrder();
          deferred.resolve();
        });
        return deferred.promise;
      }
    };

    //Create an order object using data from JSON
    Order.fromJSONData = function (jsonData) {
      var newOrder = new Order(jsonData.taxRate, jsonData.shippingFee);
      newOrder.orderNum = jsonData.orderNum;
      newOrder.payMethod = jsonData.payMethod;
      newOrder.userID = jsonData.userID;
      newOrder.sentDate = jsonData.sentDate; //TODO: Need to convert?
      newOrder.fName = jsonData.fName;
      newOrder.lName = jsonData.lName;
      newOrder.phone = jsonData.phone;
      newOrder.email = jsonData.email;
      newOrder.addr = jsonData.addr;
      newOrder.addr2 = jsonData.addr2;
      newOrder.city = jsonData.city;
      newOrder.state = jsonData.state;
      newOrder.zip = jsonData.zip;
      for (var i = 0; i < jsonData.wheelchairs.length; i++) {
        newOrder.addWheelchair(new Design(jsonData.wheelchairs[i]));
      }
      newOrder.sentDate = jsonData.sentDate;
      return newOrder;
    };

    return (Order);
  }

  ])
;
