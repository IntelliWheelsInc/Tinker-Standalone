'use strict';

/**
 * @ngdoc function
 * @name abacuApp.serives:userService
 * @description
 * # userService
 * Service of the abacuApp
 */

/*
 *
 */
angular.module('abacuApp')
.service('User', ['$http', '$location', '$q', 'localJSONStorage', 'Order', 'Wheelchair', 'Units', 'Costs', 'Design', 'Errors', 'PromiseUtils', '$rootScope',
function ($http, $location, $q, localJSONStorage, Order, Wheelchair, Units, Costs, Design, Errors, PromiseUtils, $rootScope) {

  // declare all User variables here
  var orders, currentWheelchair, cartWheelchairIndex, savedDesigns,
    userID, fName, lName, email, phone, addr, addr2, city, state,
    zip, unitSys, contentSection, cart, isAdmin, _rev;

  // initialize all user variables here
  function init() {
    orders = [];
    cart = new Order(Costs.TAX_RATE, Costs.SHIPPING_FEE, null);
    currentWheelchair = { // indicate the status of current design and hold the wheelchair instance
      isNew: false,
      editingWheelchair: null,
      design: null
    };
    cartWheelchairIndex = -1;  //Index associate with cartWheelchairs i.e cartwheelchair
    savedDesigns = [];                    // array of saved wheelchair\
    userID = -1; //-1 means not logged in
    fName = '';
    lName = '';
    email = '';
    phone = '';
    addr = '';
    addr2 = '';
    city = '';
    state = '';
    zip = '';
    unitSys = Units.unitSys.IMPERIAL;
    contentSection = 'orders';
    isAdmin = false;
    _rev = null;
    // restoreUserFromCookies();
  }

  var instance = this;

  init(); // initialize all the user variables

  function allDetails() {
    var details = {
      'userID': userID,
      'fName': fName,
      'lName': lName,
      'email': email,
      'phone': phone,
      'addr': addr,
      'addr2': addr2,
      'city': city,
      'state': state,
      'zip': zip,
      'unitSys': unitSys,
      'currentWheelchair': currentWheelchair,
      'orders': orders.map(function (order) {
        return order.getAll();
      }),
      'savedDesigns': savedDesigns.map(function (design) {
        if (design instanceof Design) {
          return design.allDetails();
        }
        return design;
      }),
      'cart': !_.isNull(cart) ? cart.getAll() : null,
      'isAdmin': isAdmin
    };

    if (_rev) { // attach the _rev only if it exists
      details._rev = _rev;
    }

    return details;
  }

  function updateDB() {
    if (userID !== -1) {
      return $http({
        url: '/update',
        data: allDetails(),
        method: 'POST'
      })
        .then(function (response) {
          // TODO: Update the revisions for all the design objects here
          var userData = response.data.user;
          restoreUserFromBackend(userData);
          return userData;
        });
    } else {
      return PromiseUtils.rejected(new Errors.NotLoggedInError('User Must Be Logged In For This Action'));
    }
  }

  function createCurrentDesign(frameID) {
    if (frameID instanceof Design) {
      var design = frameID; // frameID is actually a design instance
      currentWheelchair.isNew = !design.hasID();
      currentWheelchair.design = design;
    } else if (_.isObject(frameID)) {
      currentWheelchair.design= new Design(frameID);
      currentWheelchair.isNew = true;
    } else if (_.isNumber(frameID)) {
      // its either an integer respresenting a frame id or a wheelchair object
      currentWheelchair.isNew = true;
      currentWheelchair.design = new Design({
        'creator': userID,
        'wheelchair': new Wheelchair(frameID)
      });
    } else {
      throw new Error('Bad value given to createCurrentDesign: ' + JSON.stringify(frameID));
    }

    // decide where to persist the currentWheelchair based on whether the user is logged in
    if (userID !== -1) {
      return updateDB();
    } else {
      localJSONStorage.put('currentWheelchair', {frameID: frameID, isNew: true, index: -1});
      return PromiseUtils.resolved();
    }
  }

  function setEditWheelchair(index, design) {
    if (index >= 0 && index < cart.wheelchairs.length) {
      cartWheelchairIndex = index;
    }
    currentWheelchair.isNew = false;
    currentWheelchair.design = design;

    // decide where to persist the currentWheelchair based on whether the user is logged in
    if (userID !== -1) {
      return updateDB()
        .then(function () {
          currentWheelchair.design._rev = cart.wheelchairs[index]._rev; // update the revision number
        });
    } else {
      localJSONStorage.put('currentWheelchair', {frameID: -1, isNew: false, index: index, 'design': design});
      return PromiseUtils.resolved();
    }
  }

  function setEditWheelchairFromMyDesign(index){
    if (index >= 0 && index < savedDesigns.length) {
      currentWheelchair.isNew = false;
      currentWheelchair.design = savedDesigns[index];
    }

    if (userID !== -1) {
      return updateDB()
        .then(function () {
          currentWheelchair.design._rev = savedDesigns[index]._rev;
        });
    } else {
      localJSONStorage.put('currentWheelchair', {frameID: -1, isNew: false, index: index, 'design': design});
      return PromiseUtils.resolved();
    }
  }

  function restoreUserFromCookies() {
    //***************Cookie restore***********
    var wIndex = 0;
    while (localJSONStorage.get('design' + wIndex)){
      var design = localJSONStorage.get('design' + wIndex);
      cart.wheelchairs.push(new Design(design));
      wIndex ++;
    }

    if (cart.wheelchairs.length > 0) {
      orders.push(cart);
    }

    var tempCurrentWheelchair = localJSONStorage.get('currentWheelchair');
    if (tempCurrentWheelchair != null) {
      if (tempCurrentWheelchair.isNew === true) {
        createCurrentDesign(tempCurrentWheelchair.frameID);
      }
      else if (tempCurrentWheelchair.isNew === false) {
        setEditWheelchair(tempCurrentWheelchair.index, new Design(tempCurrentWheelchair.design));
      }
    }

    if(localJSONStorage.get('promo')) {
      cart.discounts = localJSONStorage.get('promo');
    }
  }

  function restoreUserFromBackend(data) {
    if (_.isEmpty(data) || !_.isObject(data)) {
      return;
    }

    userID = data.userID || data.email;

    if (userID !== -1) {
      fName = data.fName;
      lName = data.lName;
      email = data.email;
      phone = data.phone;
      addr = data.addr;
      addr2 = data.addr2;
      city = data.city;
      state = data.state;
      zip = data.zip;
      savedDesigns = !_.isArray(data.savedDesigns) ? [] : data.savedDesigns.map(function (designObj) {
        return _.isObject(designObj) ? new Design(designObj) : designObj; // might just be a design ID string
      });

      currentWheelchair = data.currentWheelchair || currentWheelchair;
      currentWheelchair.design = currentWheelchair.design ? new Design(currentWheelchair.design) : null;

      // Setup the cart...it is null if the user doesnt have a cart
      if (data.cart) {
        var cartID = data.cart.id || data.cart._id || null;
        cart = data.cart && cartID !== null ? new Order(Costs.TAX_RATE, Costs.SHIPPING_FEE, data.cart) : null;
      } else {
        cart = new Order(Costs.TAX_RATE, Costs.SHIPPING_FEE, null);
      }

      isAdmin = data.isAdmin || false;
      _rev = data._rev || null;
      var orderObjs = _.isArray(data.orders) ? data.orders : [];
      orders = orderObjs.map(function (orderObj) {
        return new Order(Costs.TAX_RATE, Costs.SHIPPING_FEE, orderObj);
      });
    }
  }

  //Make a request to /session. If it succeeds, restore user from response, otherwise, restore from settings
  var updatePromise = $http({
    url: '/session'
    , method: 'POST'
  })
    .then(function (response) {
      if (response.data.userID === -1) {
        // this means user is not logged in
        restoreUserFromCookies();
      } else {
        restoreUserFromBackend(response.data);
      }

      return response.data;
    })
    .catch(function (err) {
      restoreUserFromCookies();
    });


//*********functions************//

  return {

    getPromise: function () {
      return updatePromise;
    },

    allDetails: allDetails,

    /**********design share/coEdit with ID*********/
    fetchDesign: function(id) {
      return $http({
        url:'/design/' + id,
        data:{designID:id},
        method:'GET'
      })
        .then(function(response){
          //TODO load the design into current editing wheelchair variable
          var currentDesign = new Design(response.data);
          return currentDesign;
        });
    },

    saveDesign: function(design) {
      if (!this.isLoggedIn()) {
        var deferred = $q.defer();
        deferred.reject(new Errors.NotLoggedInError("Must Be Logged In"));
        return deferred.promise;
      }
      // $http({ ... }) returns a promise
      var designInstance = design instanceof Design ? design : new Design(design);
      return $http({
        url:'/design',
        data: designInstance.clone().allDetails(),
        method: 'POST'
      })
        .then(function (response) {
          return new Design(response.data);
        });
    },

    updateDesign: function (design) {
      if (!this.isLoggedIn()) {
        return PromiseUtils.rejected(new Errors.NotLoggedInError("Must Be Logged In"));
      } else if (!(design instanceof Design) || !design.hasID()) {
        return PromiseUtils.rejected(new Error("Invalid design arg"));
      }

      var designDetails = design.allDetails();
      designDetails.updatedAt = new Date();
      return $http({
        url: '/design/' + design._id,
        data: designDetails,
        method: 'PUT'
      })
        .then(function (res) {
          var designObj = res.data;
          return new Design(designObj);
        });
    },

    /************************LOGIN AND LOGOUT****************************/

    //Attempt to login as the given username with the given password
    //If successful - should load in appropriate user data
    login: function (in_email, pass) {
      var curThis = this;
      var deferred = $q.defer();

      if (!([in_email, pass].every(_.isString)) || [in_email, pass].some(_.isEmpty)) {
        deferred.reject(new Error('Missing Username or Password'));
        return deferred.promise;
      }

      var httpPromise = $http({
        url: '/login',
        data: {email: _.lowerFirst(in_email), password: pass},
        method: 'POST'
      });

      // Update the updatepromise
      updatePromise = httpPromise;

      return httpPromise
        .then(function (response) {
          var data = response.data;
          userID = data.userID;
          if (userID !== -1) {
            restoreUserFromBackend(data);
            $rootScope.$broadcast('userChange');
          } else {
            throw new Error('Incorrect email or password');

          }
        });
    },

    logout: function () {
      init(); //restore user variables to intial value

      // If there is a current order the user is working on, dont lose it
      var cart = this.getCurEditOrder();
      orders = [];
      if (cart) {
        orders.push(cart);
      }

      $http({
        url: '/logout',
        method: 'POST'
      }).success(function (data) {
          $rootScope.$broadcast('userChange');
        })
        .error(function (data) {
          console.log('Request Failed');
        });
    },

    //Returns true if the user is logged in
    isLoggedIn: function () {
      return (userID !== -1);
    },

    updateDB: updateDB,

    updateCart: function () {

      if (this.isLoggedIn()) {
        return this.updateDB();
      } else {
        // sync in memory cart with cookie storage
        localJSONStorage.remove('design'+cart.wheelchairs.length);
        for (var i = 0; i < cart.wheelchairs.length; i++) {
          localJSONStorage.put('design' + i, cart.wheelchairs[i].allDetails());
        }

        localJSONStorage.remove('promo');
        localJSONStorage.put('promo', cart.discounts)


        // Send a successfull promise resolved to the current user object
        return PromiseUtils.resolved(allDetails());
      }
    },


    /*************************MY DESIGNS*******************************/

    createCurrentDesign: createCurrentDesign,

    clearCart: function () {
      cart.wheelchairs.forEach(function (chair, idx) {
        localJSONStorage.remove('design' + idx); // clear the localStorage from the saved cart designs
      });

      localJSONStorage.remove('promo');

      cart = new Order(Costs.TAX_RATE, Costs.SHIPPING_FEE, null);
    },

    //Create a new wheelchair object of given frame type and set edit pointer to it
    pushNewWheelchair: function () {
      if (_.isNull(cart)) {
        cart = new Order(Costs.TAX_RATE, Costs.SHIPPING_FEE, null);
      }

      if (currentWheelchair.isNew === true ) {
        cart.wheelchairs.push(currentWheelchair.design);
        cartWheelchairIndex = cart.wheelchairs.length - 1;
      }
      else if (currentWheelchair.isNew === false) {
        if (cartWheelchairIndex === -1 && _.isEmpty(cart.wheelchairs)) {
          cart.wheelchairs.push(currentWheelchair.design.clone()); // means the first chair theyre trying to add is someone elses
        } else {
          cart.wheelchairs[cartWheelchairIndex] = currentWheelchair.design;
        }
      }

      return this.updateCart();
    },

    //Set the given wheelchair index to be edited
    setEditWheelchair: setEditWheelchair,

    setEditWheelchairFromMyDesign: setEditWheelchairFromMyDesign,



    // Saves the currentWheelchair into the saved wheelchairs list and resets the currentWheelchair
    addDesignIDToSavedDesigns: function (designID) {
      savedDesigns = _.reject(savedDesigns, {'_id': designID});
      savedDesigns.push(designID);
      return this.updateDB();
    },

    removeDesignFromSavedDesigns: function (design) {
      var designID = _.isString(design) ? design : design._id;
      savedDesigns = _.reject(savedDesigns, {'_id': designID});
      return this.updateDB();
    },

    //Removes the wheelchair at the given index from the user's myDesign
    deleteWheelchair: function (index) {
      cart.wheelchairs.splice(index, 1);
      return this.updateCart();
    },

    getCart: function () {
      return cart;
    },

    //Returns the full array of user-defined wheelchairs
    getCartWheelchairs: function () {
      if(_.isNull(cart)){
        return [];
      }
      return _.map(cart.wheelchairs, 'wheelchair');
    },



    getWheelchair: function (index) {
      if (index >= 0 && index < cart.wheelchairs.length)
        return cart.wheelchairs[index];
      return null;
    },

    // returns full array of users wishlist/my design wheelchairs
    getSavedDesigns: function () {
      return savedDesigns;
    },

    getOneSavedDesign: function (index) {
      if (index >= 0 && index < savedDesigns.length) {
        return savedDesigns[index];
      } else {
        return null;
      }
    },

    //Returns the wheelchair currently set as "curEditWheelchair"
    //Returns null if no chair set as curEditWheelchair
    getCurEditWheelchair: function () {
      return currentWheelchair.design.wheelchair;
    },

    getCurEditWheelchairDesign: function () {
      return currentWheelchair.design;
    },

    isNewWheelchair: function () {
      return currentWheelchair.isNew;
    },

    getNumCartWheelchairs: function () {
      return _.isNull(cart) ? 0 : cart.wheelchairs.length;
    },

    saveComputer: function () {
      var curThis = this;
      $http.post('/save', {wheelchair: this.getCurEditWheelchair().getAll()}, {responseType: 'blob'})
        .success(function (response) {
          saveAs(response, curThis.getCurEditWheelchair().title+'.pdf');
        });
    },
    /******************************MY MEASUREMENTS*******************************/

    commonMeasures: {
      REAR_SEAT_HEIGHT: -1,
      REAR_SEAT_WIDTH: -1,
      FOLDING_BACKREST_HEIGHT: -1,
      AXEL_POSITION: -1,
      SEAT_DEPTH: -1
    },


    /******************************MY ORDERS*******************************/

    getAllOrders: function () {
      return orders;
    },
    getNumOrders: function () {
      return orders.length;
    },

    //Returns an array of all orders that have been sent (ignores "unsent" orders)
    getSentOrders: function () {
      return orders;
    },

    //Creates a new "unsent" order - overwriting a previous unset order if one exists
    createNewOrder: function () {
      var lastOrder = orders[orders.length - 1];
      if (orders.length === 0 || lastOrder.hasBeenSent()) {
        cart = new Order(Costs.TAX_RATE, Costs.SHIPPING_FEE, null);
      }
    },

    //Returns the unsent Order set as the "curEditOrder"
    //If no such Order exists, returns null
    getCurEditOrder: function () {
      return cart;
    },

    //Returns the last order whether it is sent or unsent
    getLastOrder: function () {
      if (orders.length > 0) {
        return orders[orders.length - 1];
      }
    },

    //Sends the curEditOrder to the distributor
    sendCurEditOrder: function (userData, shippingData, billingData, payMethod, token) {
      var editOrder = this.getCurEditOrder();
      if (editOrder === null) {
        return PromiseUtils.rejected(new Error('CurEditOrder does not exist'));
      } else {
        return editOrder.send(userID, userData, shippingData, billingData, payMethod, token)
          .then(function (response) {
            restoreUserFromBackend(response.user);
            return response;
          });
      }
    },



    //***********get/sets
    getID: function () {
      return userID;
    },
    getFname: function () {
      return (fName.charAt(0).toUpperCase() + fName.slice(1));
    },
    getLname: function () {
      return (lName.charAt(0).toUpperCase() + lName.slice(1));
    },
    getEmail: function () {
      return email;
    },
    getPhone: function () {
      return phone;
    },
    getAddr: function () {
      return addr;
    },
    getAddr2: function () {
      return addr2;
    },
    getCity: function () {
      return city;
    },
    getState: function () {
      return state;
    },
    getZip: function () {
      return zip;
    },
    getUnitSys: function () {
      return unitSys;
    },

    getFullName: function () {
      return this.getFname() + ' ' + this.getLname();
    },
    getFullAddr: function () {
      var a2 = addr2;
      if (addr2 !== '')
        a2 = ' ' + a2;
      return addr + a2;
    },
    getContentSection: function () {
      return contentSection;
    },

    isAdmin: function () {
      return isAdmin;
    },
    setFname: function (newFName) {
      fName = newFName;
    },
    setLname: function (newLName) {
      lName = newLName;
    },
    setEmail: function (newEmail) {
      email = newEmail;
    },
    setPhone: function (newPhone) {
      phone = newPhone;
    },
    setAddr: function (newAddr) {
      addr = newAddr;
    },
    setAddr2: function (newAddr2) {
      addr2 = newAddr2;
    },
    setCity: function (newCity) {
      city = newCity;
    },
    setState: function (newState) {
      state = newState;
    },
    setZip: function (newZip) {
      zip = newZip;
    },
    setUnitSys: function (newUnitSys) {
      unitSys = newUnitSys;
    },
    setContentSection: function (newSection) {
      contentSection = newSection;
    }
  };

}]);



