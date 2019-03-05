/** @format */

import React, {useState, useEffect} from 'react'
import {render} from 'react-dom'

import user from './user'
import * as toast from './toast'
import {
  loadContract,
  getUserOffers,
  getUserTokens,
  getAllOffers,
  getAllTokens,
  makeCall
} from './contract'
import Game, {fetchGame} from './Game'
import Invoice from './Invoice'
import PasteInvoice from './PasteInvoice'

const initialGame = localStorage.getItem('gameid') || '16849624'

function App() {
  let [contractState, setContractState] = useState({
    tokens: {},
    offers: {},
    balances: {}
  })
  let [selectedGame, setSelectedGame] = useState(initialGame)
  let [selectedGameData, setSelectedGameData] = useState()
  let [showingInvoice, showInvoice] = useState(null)
  let [showingPasteInvoice, showPasteInvoice] = useState(null)

  let userBalance = contractState.balances[user.id] || 0
  let userOffers = getUserOffers(contractState, user.id)
  let userTokens = getUserTokens(contractState, user.id)
  let allOffers = getAllOffers(contractState)
  let allTokens = getAllTokens(contractState)

  useEffect(
    () => {
      if (selectedGameData) {
        localStorage.setItem('gameid', selectedGameData.id)
      }
    },
    [selectedGameData]
  )

  useEffect(
    () => {
      fetchGame(contractState, initialGame).then(setSelectedGameData)
    },
    [contractState]
  )

  useEffect(() => {
    loadContract().then(setContractState)
  }, [])

  async function handleGameClick(e) {
    e.preventDefault()
    setSelectedGame(e.target.dataset.gameid)
    setSelectedGameData(await fetchGame(contractState, e.target.dataset.gameid))
  }

  async function handleWithdraw(e) {
    e.preventDefault()
    try {
      await makeCall(
        'withdraw',
        0,
        {userid: user.id, _key: user.key},
        {showInvoice, showPasteInvoice, invoiceAt: '_invoice'}
      )
      toast.success(`Withdraw queued successfully.`)
      setContractState(await loadContract())
    } catch (e) {}
  }

  return (
    <div>
      {showingInvoice ? <Invoice {...showingInvoice} /> : null}
      {showingPasteInvoice ? <PasteInvoice {...showingPasteInvoice} /> : null}
      <nav>
        <div className="header">Satoshi Go Bet</div>
        <div className="user-id">{user.id}</div>
        <div className="user-balance">
          {userBalance}{' '}
          {userBalance > 0 ? <a onClick={handleWithdraw}>withdraw</a> : null}
        </div>
        <div className="user-offers">{userOffers.length}</div>
        <div className="user-tokens">{userTokens.length}</div>
      </nav>
      <main>
        <Game
          selectedGame={selectedGame}
          setSelectedGame={setSelectedGame}
          selectedGameData={selectedGameData}
          setSelectedGameData={setSelectedGameData}
          contractState={contractState}
          showInvoice={showInvoice}
          setContractState={setContractState}
        />
        <div id="global">
          <p>
            <b>Explanation: </b> each token is worth 10 satoshis if it wins, 0
            otherwise. When you bet a quantity x on a game you pay x*10 and get
            x white tokens and x black tokens, then you can sell the tokens for
            the player you think will lose (for less than 10 satoshis). You can
            also just buy tokens from others instead of opening new bets.
          </p>
          <h2>Global stuff</h2>
          <div>
            <h3>all offers</h3>
            <div>
              {Object.keys(allOffers).length === 0
                ? 'none'
                : Object.keys(allOffers).map(gameid => (
                    <div key={gameid}>
                      <h4>
                        <a data-gameid={gameid} onClick={handleGameClick}>
                          game {gameid}
                        </a>
                      </h4>
                      <div>
                        {['black', 'white'].map(winner => (
                          <div key={winner}>
                            {allOffers[gameid][winner] &&
                            allOffers[gameid][winner].length !== 0 ? (
                              <>
                                <h5>{winner}</h5>
                                {allOffers[gameid][winner].map(
                                  ({amount, price, seller}, i) => (
                                    <div key={i}>
                                      {amount} at {price}
                                      sats from {seller.slice(0, 4)}…
                                    </div>
                                  )
                                )}{' '}
                              </>
                            ) : (
                              'none'
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
            </div>
          </div>
          <div>
            <h3>all tokens</h3>
            <div>
              {Object.keys(allTokens).length === 0
                ? 'none'
                : Object.keys(allTokens).map(gameid => (
                    <div key={gameid}>
                      <h4>
                        <a data-gameid={gameid} onClick={handleGameClick}>
                          game {gameid}
                        </a>
                      </h4>
                      <div>
                        {Object.keys(allTokens[gameid]).map(userid => (
                          <div key={userid}>
                            {userid.slice(0, 4)}
                            …: {allTokens[gameid][userid].black} black,{' '}
                            {allTokens[gameid][userid].white} white
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
        <div id="user">
          <h2>Your stuff</h2>
          <div>
            <h4>your offers</h4>
            {userOffers.length === 0
              ? 'none'
              : userOffers.map(({amount, gameid, winner, price}, i) => (
                  <div key={i}>
                    {amount} on {winner}@
                    <a data-gameid={gameid} onClick={handleGameClick}>
                      {gameid}
                    </a>{' '}
                    at {price}
                    sats
                  </div>
                ))}
          </div>
          <div>
            <h4>your tokens</h4>
            {userTokens.length === 0
              ? 'none'
              : userTokens.map(({amount, gameid, winner}, i) => (
                  <div key={i}>
                    {amount} on {winner}@
                    <a data-gameid={gameid} onClick={handleGameClick}>
                      {gameid}
                    </a>{' '}
                  </div>
                ))}
          </div>
          <p>
            This website is just a client for the{' '}
            <a
              href={`${window.etleneum}/contract/${window.contract}`}
              target="_blank"
            >
              {window.contract} Etleneum contract
            </a>
            . If something goes wrong we can't do anything, code is law.
          </p>
        </div>
      </main>
    </div>
  )
}

render(<App />, document.getElementById('app'))
