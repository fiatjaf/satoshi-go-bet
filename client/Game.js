/** @format */

import React, {useState, useEffect} from 'react'
import {useDebounce} from 'use-debounce'
import Goban from 'react-goban-svg'
import clone from 'just-clone'
import get from 'just-safe-get'

import * as toast from './toast'
import user from './user'
import {useComputed} from './helpers'
import {loadContract, makeCall, offersForGame, tokensForGame} from './contract'

// blank stonemap
const blankStonemap = []
for (let i = 0; i < 19; i++) {
  blankStonemap[i] = []
}
// handicap placements
const handicapPlacements = [
  [],
  [],
  [[15, 3], [3, 15]],
  [[15, 3], [3, 15], [15, 15]],
  [[15, 3], [3, 15], [15, 15], [3, 3]],
  [[15, 3], [3, 15], [15, 15], [3, 3], [9, 9]],
  [[15, 3], [3, 15], [15, 15], [3, 3], [3, 9], [15, 9]],
  [[15, 3], [3, 15], [15, 15], [3, 3], [3, 9], [15, 9], [9, 9]],
  [[15, 3], [3, 15], [15, 15], [3, 3], [3, 9], [15, 9], [9, 3], [9, 15]],
  [[15, 3], [3, 15], [15, 15], [3, 3], [3, 9], [15, 9], [9, 3], [9, 15], [9, 9]]
]
// ~

const OPENING_BET = 'OPENING_BET'
const MAKING_OFFER_FOR = 'MAKING_OFFER_FOR'
const BUYING_OFFER_FOR = 'BUYING_OFFER_FOR'
const NONE = 'NONE'

export default function Game({
  selectedGame,
  setSelectedGame,
  contractState,
  setContractState,
  showInvoice
}) {
  let [action, setAction] = useState({action: NONE})
  let [gameData, setGameData] = useState()
  let [contractGameData, setContractGameData] = useState({})
  let [loading, setLoading] = useState(false)
  let [debouncedSelectedGame] = useDebounce(selectedGame, 3000)
  let currentGameId = useComputed(debouncedSelectedGame, getGameId)

  useEffect(
    () => {
      sessionStorage.setItem('gameid', (gameData || {}).id)
    },
    [gameData]
  )

  useEffect(
    () => {
      setAction({action: NONE})
      setGameData(null)
      setContractGameData(null)
    },
    [selectedGame]
  )

  useEffect(
    () => {
      if (contractState && gameData) {
        setContractGameData(buildContractGameData(contractState, gameData.id))
      }
    },
    [contractState, gameData]
  )

  useEffect(
    () => {
      if (!contractState || !currentGameId) return

      setLoading(true)
      setGameData(null)
      setContractGameData(null)

      const ws = new WebSocket(
        'wss://online-go.com/socket.io/?EIO=3&transport=websocket'
      )
      var canceled = false

      ws.onmessage = ({data}) => {
        if (canceled) return

        if (
          data.slice(0, 9 + currentGameId.length) ===
          `42["game/${currentGameId}`
        ) {
          let [mkind, pdata] = JSON.parse(data.slice(2))
          switch (mkind) {
            case `game/${currentGameId}/gamedata`:
              setGameData(buildGameData(pdata))
              setLoading(false)
              break
            case `game/${currentGameId}/move`:
              incrementStoneMap(gameData, pdata.move, gameData.next)
              setGameData(gameData)
              break
            case `game/${currentGameId}/clock`:
              break
          }
        } else if (data.slice(0, 13) === '42["net/pong"') {
          setTimeout(() => {
            if (!canceled)
              ws.send(
                `42["net/ping",{"client":${new Date().getTime()},"drift":-179,"latency":672}]`
              )
          }, 10000)
        }
      }

      ws.onopen = () => {
        ws.send(
          `42["game/connect",{"game_id":${currentGameId},"player_id":0,"chat":true}]`
        )
      }

      const stop = () => {
        canceled = true
        ws.close()
      }

      return stop
    },
    [debouncedSelectedGame]
  )

  useEffect(
    () => {
      if (!gameData) return

      if (gameData.status === 'finished') {
        fetchGameWinner(gameData.id).then(winner =>
          setGameData({...gameData, winner})
        )
      }
    },
    [gameData && gameData.status]
  )

  function handleStartOpeningBet(e) {
    e.preventDefault()
    setAction({action: OPENING_BET})
  }

  async function handleOpenBet(e) {
    e.preventDefault()

    try {
      await makeCall(
        'newbet',
        parseInt(e.target.satoshis.value),
        {gameid: currentGameId, userid: user.id},
        {showInvoice}
      )
      toast.success('Bet made!')
      setContractState(await loadContract())
    } catch (e) {}
  }

  async function handleRedeem(e) {
    e.preventDefault()

    try {
      await makeCall('redeem', 0, {gameid: currentGameId}, {showInvoice})
      toast.success('Tokens redeemed!')
      setContractState(await loadContract())
    } catch (e) {}
  }

  function handleStartMakingOffer(e) {
    e.preventDefault()
    setAction({action: MAKING_OFFER_FOR, winner: e.target.dataset.winner})
  }

  async function handleMakeOffer(e) {
    e.preventDefault()

    try {
      await makeCall(
        'selloffer',
        0,
        {
          gameid: currentGameId,
          winner: action.winner,
          price: e.target.price.value,
          amount: e.target.amount.value,
          userid: user.id,
          _key: user.key
        },
        {showInvoice}
      )
      toast.success('Offer created, now you must find a buyer.')
      setContractState(await loadContract())
    } catch (e) {}
  }

  async function handleUnoffer(e) {
    e.preventDefault()

    let gameid = currentGameId
    let winner = e.target.dataset.winner

    try {
      await makeCall(
        'unoffer',
        0,
        {
          gameid,
          winner,
          userid: user.id,
          _key: user.key
        },
        {showInvoice}
      )
      toast.success(`Offers for ${winner}@${gameid} were removed.`)
      setContractState(await loadContract())
    } catch (e) {}
  }

  function handleStartBuyingOffer(e) {
    e.preventDefault()
    setAction({action: BUYING_OFFER_FOR, winner: e.target.dataset.winner})
  }

  async function handleBuyOffer(e) {
    e.preventDefault()
    let winner = action.winner

    try {
      let {bought, spent} = await makeCall(
        'buyoffer',
        parseInt(e.target.satoshis.value),
        {
          gameid: currentGameId,
          winner,
          maxprice: e.target.maxprice.value,
          userid: user.id
        },
        {showInvoice}
      )
      toast.success(
        `Bought ${bought} ${winner} tokens for a total of ${spent} satoshis.`
      )
      setContractState(await loadContract())
    } catch (e) {}
  }

  return (
    <div id="game">
      <p>
        You can choose any game from{' '}
        <a href="https://online-go.com/observe-games" target="_blank">
          this list
        </a>{' '}
        (you probably want correspondence games) and paste its URL or id here to
        start making bets.
      </p>
      <div className="game-input">
        <input
          onChange={e => setSelectedGame(e.target.value)}
          value={selectedGame}
          disabled={loading}
        />
      </div>
      {!loading && gameData ? (
        <div className="wrapper">
          <Goban
            rows={gameData.size}
            cols={gameData.size}
            data={gameData.stonemap}
            click={() => {}}
          />
          {contractGameData ? (
            <div className="info">
              <a
                href={`https://online-go.com/game/${gameData.id}`}
                target="_blank"
              >
                game {gameData.id}
              </a>
              <div>{gameData.status}</div>
              <div>black: {gameData.black}</div>
              <div>white: {gameData.white}</div>
              {gameData.status === 'finished' ? (
                <>
                  <br />
                  <div>
                    winner: <b>{gameData.winner}</b>
                  </div>
                  {Object.keys(contractGameData.tokens).length ||
                  constractGameData.offers.black.length ||
                  constractGameData.offers.white.length ? (
                    <button onClick={handleRedeem}>redeem tokens</button>
                  ) : null}
                  <br />
                </>
              ) : null}
              <br />
              <div>
                <strong>your tokens</strong>
                {['black', 'white'].map(winner => (
                  <div key={winner}>
                    <span>
                      {winner}: {contractGameData.userTokens[winner]}
                      {contractGameData.userTotalOffered[winner] > 0 ? (
                        <>
                          {' '}
                          ({contractGameData.userTotalOffered[winner]})
                          {gameData.status === 'finished' ? (
                            <button
                              data-winner={winner}
                              onClick={handleUnoffer}
                            >
                              unoffer
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </span>
                    {gameData.status === 'play' ? (
                      action.action === MAKING_OFFER_FOR &&
                      action.winner === winner ? (
                        <form onSubmit={handleMakeOffer}>
                          <label>
                            amount
                            <br />
                            <input
                              name="amount"
                              type="number"
                              step="1"
                              min="1"
                              defaultValue={contractGameData.userTokens[winner]}
                            />
                          </label>
                          <label>
                            price
                            <br />
                            <input
                              name="price"
                              type="number"
                              step="1"
                              min="1"
                              max="9"
                              defaultValue="5"
                            />
                          </label>
                          <button>make offer</button>
                        </form>
                      ) : contractGameData.userTokens[winner] ? (
                        <>
                          {' '}
                          <button
                            onClick={handleStartMakingOffer}
                            data-winner={winner}
                          >
                            sell
                          </button>
                        </>
                      ) : null
                    ) : null}
                  </div>
                ))}
                <br />
                {gameData.status === 'play' ? (
                  action.action === OPENING_BET ? (
                    <form onSubmit={handleOpenBet}>
                      <label>
                        satoshis to spend
                        <br />
                        <input
                          name="satoshis"
                          type="number"
                          step="10"
                          min="10"
                          defaultValue="100"
                        />
                      </label>
                      <button>bet</button>
                    </form>
                  ) : (
                    <button onClick={handleStartOpeningBet}>open bet</button>
                  )
                ) : null}
              </div>
              <div>
                {['black', 'white'].map(winner => (
                  <div key={winner}>
                    <br />
                    <strong>{winner} open offers</strong>
                    <div>
                      {contractGameData.offers[winner] &&
                      contractGameData.offers[winner].length !== 0 ? (
                        <>
                          {contractGameData.offers[winner].map(
                            ({price, amount}, i) => (
                              <div key={i}>
                                {amount} tokens at {price}
                                sats each
                              </div>
                            )
                          )}
                          {gameData.status === 'play' ? (
                            action.action === BUYING_OFFER_FOR &&
                            action.winner === winner ? (
                              <form onSubmit={handleBuyOffer}>
                                <label>
                                  maxprice
                                  <br />
                                  <input
                                    name="maxprice"
                                    type="number"
                                    step="1"
                                    min="1"
                                    max="9"
                                    defaultValue={
                                      contractGameData.offers[winner].slice(
                                        -1
                                      )[0].price
                                    }
                                  />
                                </label>
                                <label>
                                  total sats
                                  <br />
                                  <input
                                    type="number"
                                    name="satoshis"
                                    min="1"
                                    defaultValue={
                                      9 *
                                      contractGameData.offers[winner].reduce(
                                        (acc, o) => acc + o.amount,
                                        0
                                      )
                                    }
                                  />
                                </label>
                                <button>send buy order</button>
                              </form>
                            ) : (
                              <button
                                data-winner={winner}
                                onClick={handleStartBuyingOffer}
                              >
                                buy
                              </button>
                            )
                          ) : null}
                        </>
                      ) : (
                        'none'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function getGameId(gameIdOrURL) {
  try {
    return /\d\d\d\d\d+/.exec(gameIdOrURL)[0]
  } catch (e) {
    return ''
  }
}

function buildGameData(gamedata) {
  let [stonemap, next] = buildStoneMap(gamedata)

  return {
    id: gamedata.game_id,
    stonemap,
    next,
    size: gamedata.height,
    status: gamedata.phase,
    black: gamedata.players.black.username,
    white: gamedata.players.white.username
  }
}

function buildStoneMap(gamedata) {
  var stonemap = clone(blankStonemap)

  let hplacements = handicapPlacements[gamedata.handicap || 0]
  for (let h = 0; h < hplacements.length; h++) {
    let place = hplacements[h]
    incrementStoneMap(
      {stonemap},
      place,
      0 /* such that all these placements are black */
    )
  }

  var i
  let whoStarts = gamedata.handicap < 2 ? 0 : 1 // black or white

  for (i = 0; i < gamedata.moves.length; i++) {
    let move = gamedata.moves[i]
    incrementStoneMap({stonemap}, move, i + whoStarts)
  }
  return [stonemap, i + 1]
}

function incrementStoneMap(gameData, move, nextcolorsequence) {
  const colors = ['B', 'W'] // black first
  let nextcolor = colors[nextcolorsequence % 2]
  let [y, x] = move
  if (x !== -1 && y !== -1) gameData.stonemap[x][y] = nextcolor
  gameData.next++
}

async function fetchGameWinner(gameid) {
  let r = await fetch(`https://online-go.com/api/v1/games/${gameid}`)
  if (!r.ok) {
    console.log('error: ' + (await r.text()))
    return
  }

  let game = await r.json()
  return game.black_lost ? 'white' : game.white_lost ? 'black' : null
}

function buildContractGameData(contractState, gameid) {
  return {
    offers: offersForGame(contractState, gameid),
    tokens: tokensForGame(contractState, gameid),
    userTokens: {
      black: get(contractState, ['tokens', gameid, 'black', user.id]) || 0,
      white: get(contractState, ['tokens', gameid, 'white', user.id]) || 0
    },
    userTotalOffered: {
      black: (get(contractState, ['offers', gameid, 'black']) || [])
        .filter(o => o.seller === user.id)
        .reduce((acc, o) => acc + o.amount, 0),
      white: (get(contractState, ['offers', gameid, 'white']) || [])
        .filter(o => o.seller === user.id)
        .reduce((acc, o) => acc + o.amount, 0)
    }
  }
}
