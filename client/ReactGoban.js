/** @format */

var ReactDOM = require('react-dom')
var React = require('react')
var Goban = require('react-goban').Goban

const letters = 'abcdefghjklmnopqrst'

var App = function(props) {
  props.theme = 'paper'
  props.coordSystem = 'aa'
  props.onIntersectionClick = function() {}

  var stonemap = {}
  for (let i = 0; i < props.stones.length; i++) {
    let color = i % 2 === 0 ? 'black' : 'white'
    let [x, y] = props.stones[u]
    stonemap[`${letters[x]}${letters[y]}`] = color
  }

  return React.createElement(Goban, props, null)
}
App.displayName = 'Goban'

module.exports = App
