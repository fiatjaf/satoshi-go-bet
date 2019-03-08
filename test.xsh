import sys
import uuid
import json
import hashlib
import subprocess

aliases['run'] = $HOME + '/comp/go/src/github.com/fiatjaf/etleneum/runcall'
def make_user():
    key = str(uuid.uuid4())
    id = hashlib.sha256(key.encode('ascii')).hexdigest()
    return key, id

def after(r):
    if not r:
        print(r.output)
        exit
    global state, jsonstate
    jsonstate = $(echo @(r.output) | jq .State)
    print('state after: ' + jsonstate)
    state = json.loads(jsonstate)

key1, id1 = make_user()
key2, id2 = make_user()
gameid = '999999999999999'
withdraw_toomuch = 'lnbc10u1pw8hwmzpp5awlp7xqyyknc3yfmnhg59sk4hfexmfpemrx2m4hrg7k3pdmfmwysdq2w9mk2am3v5xqxae4j0lcqp2rzjqtqkejjy2c44jrwj08y5ygqtmn8af7vscwnflttzpsgw7tuz9r407zyusgqq44sqqqqqqqqqqqqqqqgqpckcnfy2j42leleand2hseqv4zgsc06upmmn6sj509nrahvcdmnkyjvn39785cks97mcnqvatmag4l2hpxdvke0jhgq798m85jmkdrntspg4rm2z'
withdraw_10 = 'lnbc100n1pw8hw3upp552llrqm5274emxpkjyguxtuyxgxwcs8n75sc87fax6mv0asnptksdq2w9mk2am3v5xqxae4j0lcqp2rzjqtqkejjy2c44jrwj08y5ygqtmn8af7vscwnflttzpsgw7tuz9r407zyusgqq44sqqqqqqqqqqqqqqqgqpc5dhs4tmlgmc9z7aw4d236y3c24qd48zdkyk2hse75h4ef28lmaw53dx560d8ddy8503xp0zr8xmwc4fehcf0m55mgf6hlkczca5h7mgpru0jma'
gamerunning = '{"gamedata": {"phase": "play"}}'
gameended = '{"gamedata": {"phase": "finished"}, "black_lost": false, "white_lost": true}'

print('init')
r = !(run --contract contract.lua --method __init__)
after(r)
assert state == {'balances': {}, 'offers': {}, 'tokens': {}}

print('make bet')
payload = json.dumps({'gameid': gameid, 'userid': id1})
r = !(run --contract contract.lua --method newbet --payload @(payload) --state @(jsonstate) --satoshis 207 --http @(gamerunning))
after(r)
assert state['balances'] == {id1: 7}
assert state['offers'] == {}
assert state['tokens'] == {gameid: {'black': {id1: 20}, 'white': {id1: 20}}}

print('open many sell offers')
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 9, 'price': 4, 'winner': 'black'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 4, 'price': 6, 'winner': 'black'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 2, 'price': 5, 'winner': 'black'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 4, 'price': 7, 'winner': 'black'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 10, 'price': 9, 'winner': 'white'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)
assert state['balances'] == {id1: 7}
assert state['offers'][gameid]['black'] == [{'amount': 9, 'price': 4, 'seller': id1}, {'amount': 2, 'price': 5, 'seller': id1}, {'amount': 4, 'price': 6, 'seller': id1}, {'amount': 4, 'price': 7, 'seller': id1}]
assert state['offers'][gameid]['white'] == [{'amount': 10, 'price': 9, 'seller': id1}]
assert state['tokens'][gameid] == {'black': {id1: 1}, 'white': {id1: 10}}

print('remove the white offer then redo it')
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'winner': 'white'})
r = !(run --contract contract.lua --method unoffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)
assert 'white' not in state['offers'][gameid]
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 10, 'price': 9, 'winner': 'white'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)

print('buy some of the offers with another user (contrained by money)')
payload = json.dumps({'gameid': gameid, 'userid': id2, 'maxprice': 10, 'winner': 'black'})
r = !(run --contract contract.lua --method buyoffer --payload @(payload) --state @(jsonstate) --satoshis=43 --http @(gamerunning))
after(r)
assert state['balances'] == {id1: 7 + 4*9 + 5*1,
                             id2: 43 - (4*9 + 5*1)}
assert state['offers'][gameid]['black'] == [{'amount': 1, 'price': 5, 'seller': id1}, {'amount': 4, 'price': 6, 'seller': id1}, {'amount': 4, 'price': 7, 'seller': id1}]
assert state['tokens'][gameid]['black'] == {id1: 1,
                                            id2: 10}

print('buy some of the offers with another user (contrained by maxprice)')
payload = json.dumps({'gameid': gameid, 'userid': id2, 'maxprice': 6, 'winner': 'black'})
r = !(run --contract contract.lua --method buyoffer --payload @(payload) --state @(jsonstate) --satoshis=200 --http @(gamerunning))
after(r)
assert state['balances'] == {id1: 7 + 4*9 + 5*1 + 5*1 + 6*4,
                             id2: 43 - (4*9 + 5*1) + 200 - (5*1 + 6*4)}
assert state['offers'][gameid]['black'] == [{'amount': 4, 'price': 7, 'seller': id1}]
assert state['tokens'][gameid]['black'] == {id1: 1,
                                            id2: 15}

print('fail to withdraw more than the balance')
payload = json.dumps({'userid': id2, '_key': key2, '_invoice': withdraw_toomuch})
r = !(run --contract contract.lua --method withdraw  --payload @(payload) --state @(jsonstate))
if r:
    fail('call should have errored')
print('')

print('fail to withdraw with an invalid key')
payload = json.dumps({'userid': id2, '_key': 'abc', '_invoice': withdraw_10})
r = !(run --contract contract.lua --method withdraw  --payload @(payload) --state @(jsonstate))
if r:
    fail('call should have errored')
print('')

print('withdraw with a valid key')
payload = json.dumps({'userid': id2, '_key': key2, '_invoice': withdraw_10})
r = !(run --contract contract.lua --method withdraw  --payload @(payload) --state @(jsonstate) --funds 100000000)
after(r)
assert state['balances'] == {id1: 7 + 4*9 + 5*1 + 5*1 + 6*4,
                             id2: 43 - (4*9 + 5*1) + 200 - (5*1 + 6*4) - 10}

print('try to open an offer with more tokens than owned')
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 8, 'price': 6, 'winner': 'black'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
if r:
    fail('call should have errored')
print('')

print('try to open an offer after the game has finished')
payload = json.dumps({'gameid': gameid, 'userid': id1, '_key': key1, 'amount': 1, 'price': 10, 'winner': 'black'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gameended))
if r:
    fail('call should have errored')
print('')

print('try to buy an offer after the game has finished')
payload = json.dumps({'gameid': gameid, 'userid': id2, 'maxprice': 100, 'winner': 'white'})
r = !(run --contract contract.lua --method buyoffer --payload @(payload) --state @(jsonstate) --satoshis=200 --http @(gameended))
if r:
    fail('call should have errored')
print('')

print('redeem')
payload = json.dumps({'gameid': gameid})
r = !(run --contract contract.lua --method redeem --payload @(payload) --state @(jsonstate) --http @(gameended))
after(r)
assert state['balances'] == {id1: 7 + 4*9 + 5*1 + 5*1 + 6*4 + 1*10 + 4*10,
                             id2: 43 - (4*9 + 5*1) + 200 - (5*1 + 6*4) - 10 + 15*10}
assert state['offers'] == {}
assert state['tokens'] == {}

# enter two new users for a new test on a different game
key3, id3 = make_user()
key4, id4 = make_user()
gameid = '8888888888888'

print('make bet an place offer')
payload = json.dumps({'gameid': gameid, 'userid': id3})
r = !(run --contract contract.lua --method newbet --payload @(payload) --state @(jsonstate) --satoshis 100 --http @(gamerunning))
after(r)
payload = json.dumps({'gameid': gameid, 'userid': id3, '_key': key3, 'amount': 10, 'price': 9, 'winner': 'black'})
r = !(run --contract contract.lua --method selloffer --payload @(payload) --state @(jsonstate) --http @(gamerunning))
after(r)
assert state['balances'].get(id3, 0) == 0
assert state['balances'].get(id4, 0) == 0
assert state['tokens'][gameid]['white'][id3] == 10
assert state['tokens'][gameid]['black'][id3] == 0
assert state['offers'][gameid]['black'][0] == {'seller': id3, 'amount': 10, 'price': 9}

print('buy 8 of the tokens with the other user -- should have a remainder of 4')
payload = json.dumps({'gameid': gameid, 'userid': id4, 'maxprice': 9, 'winner': 'black'})
r = !(run --contract contract.lua --method buyoffer --payload @(payload) --state @(jsonstate) --satoshis=76 --http @(gamerunning))
after(r)
assert state['offers'][gameid]['black'][0] == {'seller': id3, 'amount': 2, 'price': 9}
assert state['tokens'][gameid]['black'][id3] == 0
assert state['tokens'][gameid]['black'][id4] == 8
assert state['balances'][id3] == 72
assert state['balances'][id4] == 4
