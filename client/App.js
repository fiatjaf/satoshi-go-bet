/** @format */

import React, {useState, useEffect} from 'react'
import {render} from 'react-dom'
import humanizeDuration from 'humanize-duration'

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
import Game from './Game'
import Invoice from './Invoice'
import PasteInvoice from './PasteInvoice'

const duration = humanizeDuration.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      y: () => 'y',
      mo: () => 'mo',
      w: () => 'w',
      d: () => 'd',
      h: () => 'h',
      m: () => 'm',
      s: () => 's',
      ms: () => 'ms'
    }
  }
})

function App() {
  let [contractState, setContractState] = useState({
    tokens: {},
    offers: {},
    balances: {}
  })
  let [selectedGame, setSelectedGame] = useState(
    sessionStorage.getItem('gameid') || ''
  )
  let [showingInvoice, showInvoice] = useState(null)
  let [showingPasteInvoice, showPasteInvoice] = useState(null)
  let [gamesList, setGamesList] = useState([])

  let userBalance = contractState.balances[user.id] || 0
  let userOffers = getUserOffers(contractState, user.id)
  let userTokens = getUserTokens(contractState, user.id)
  let allOffers = getAllOffers(contractState)
  let allTokens = getAllTokens(contractState)

  useEffect(() => {
    loadContract().then(setContractState)
  }, [])

  useEffect(() => {
    if (gamesList.length > 0) return // only fetch this once ever

    const ws = new WebSocket(
      'wss://online-go.com/socket.io/?EIO=3&transport=websocket'
    )
    ws.onmessage = ({data}) => {
      if (data.slice(0, 4) === '430[') {
        let list = JSON.parse(data.slice(3))[0].results
        if (list.length !== 0) {
          setGamesList(list)
          if (!selectedGame) {
            setSelectedGame(list[0].id)
          }
          ws.close()
        }
      }
    }

    ws.onopen = () => {
      ws.send(
        '420["gamelist/query",{"list":"corr","sort_by":"rank","from":-9,"limit":12}]'
      )
    }
  }, [])

  async function handleGameClick(e) {
    e.preventDefault()
    setSelectedGame(e.target.dataset.gameid)
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
          <div>
            <h3>All offers</h3>
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
                      <ul>
                        {['black', 'white'].map(
                          winner =>
                            allOffers[gameid][winner] &&
                            allOffers[gameid][winner].length !== 0 ? (
                              <>
                                {allOffers[gameid][winner].map(
                                  ({amount, price, seller}, i) => (
                                    <li key={i}>
                                      {amount} for {winner} at {price}
                                      sats from {seller.slice(0, 4)}…
                                    </li>
                                  )
                                )}
                              </>
                            ) : null
                        )}
                      </ul>
                    </div>
                  ))}
            </div>
          </div>
          <div>
            <h3>Some available games</h3>
            <ul>
              {gamesList.map(game => (
                <li key={game.id}>
                  <a data-gameid={game.id} onClick={handleGameClick}>
                    {game.white.username} x {game.black.username}
                  </a>{' '}
                  on move {game.move_number} with{' '}
                  {duration(game.time_per_move * 1000, {
                    largest: 1,
                    round: true,
                    spacer: ''
                  })}{' '}
                  per move
                </li>
              ))}
              <a href="https://online-go.com/observe-games" target="_blank">
                more…
              </a>
            </ul>
          </div>
        </div>
        <div id="user">
          <div>
            <h3>Your tokens</h3>
            <ul>
              {userTokens.length === 0
                ? 'none'
                : userTokens.map(({amount, gameid, winner}, i) => (
                    <li key={i}>
                      {amount} on {winner}@
                      <a data-gameid={gameid} onClick={handleGameClick}>
                        {gameid}
                      </a>{' '}
                    </li>
                  ))}
            </ul>
          </div>
          <div>
            <h3>Your offers</h3>
            <ul>
              {userOffers.length === 0
                ? 'none'
                : userOffers.map(({amount, gameid, winner, price}, i) => (
                    <li key={i}>
                      {amount} on {winner}@
                      <a data-gameid={gameid} onClick={handleGameClick}>
                        {gameid}
                      </a>{' '}
                      at {price}
                      sats
                    </li>
                  ))}
            </ul>
          </div>
          <div>
            <h4>Disclaimer</h4>
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
        </div>
      </main>
    </div>
  )
}

window.etleneum = process.env.ETLENEUM_URL
window.contract = process.env.CONTRACT_ID

render(<App />, document.getElementById('app'))
