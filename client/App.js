/** @format */

import React, {useState, useEffect} from 'react'
import {render} from 'react-dom'
import memoize from 'memoize-one'

import user from './user'
import Game from './Game'

function App() {
  let [contractState, setContractState] = useState({
    tokens: {},
    offers: {},
    balances: {}
  })
  let [selectedGameData, setSelectedGameData] = useState()

  let userBalance = contractState.balances[user.id]
  let userOffers = getUserOffers(contractState.offers, user.id)
  let userBets = getUserBets(contractState.tokens, user.id)

  useEffect(() => {
    fetch('https://etleneum.com/~/contract//state').then(async r => {
      if (!r.ok) {
        console.log('error: ' + (await r.text()))
        return
      }

      setContractState(await r.json())
    })
  }, [])

  return (
    <div>
      <nav>
        <div className="header">Satoshi Go Bet</div>
        <div className="user-id">{user.id}</div>
        <div className="user-balance">{userBalance}</div>
        <div className="user-offers">{userOffers.length}</div>
        <div className="user-tokens">{userBets.length}</div>
      </nav>
      <Game
        selectedGameData={selectedGameData}
        setSelectedGameData={setSelectedGameData}
        contractState={contractState}
      />
    </div>
  )
}

const getUserBets = memoize(function(tokens, userId) {
  var userBets = []

  for (let gameid in tokens) {
    for (let winner in tokens[gameid]) {
      let tokens = tokens[gameid][userId]
      if (tokens) {
        userBets.push({gameid, winner, amount: tokens})
      }
    }
  }

  return userBets
})

const getUserOffers = memoize(function(offers, userId) {
  var userOffers = []

  for (let gameid in offers) {
    for (let winner in offers[gameid]) {
      for (let i = 0; i < offers[gameid][winner].length; i++) {
        let offer = offers[gameid][winner][i]
        if (offer.seller === userId) {
          userOffers.push({...offer, winner, gameid})
        }
      }
    }
  }

  return userOffers
})

render(<App />, document.getElementById('app'))
