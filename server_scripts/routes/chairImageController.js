/*
 * This contains all the amazon s3 storage function
 */
const path = require('path');
var router = require('express').Router();

// URL ofcloudfront
const CLOUDFRONT_BASE_URL = 'http://duqb7w6xgn312.cloudfront.net/';

const chairPicRetriever = require('../services/chairPicRetriever');

router.get('/images/chairPic/*',function(req,res){
  const imgURL = req.path;
  const imgKey = imgURL.replace('/images/chairPic/', '');

  //redirect all the picture request through cloud front
  const cloudfrontURL = CLOUDFRONT_BASE_URL + imgKey;
  res.redirect(cloudfrontURL);
});

module.exports = router;
