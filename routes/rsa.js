const BigInt = require("big-integer");

const base = 128;
const Limit = 64;
let set = new String();

for(let i=0;i<256;i++){
	set += String.fromCharCode(i);
}

const RandomBig = () => {
	let random = new BigInt(String.fromCharCode(0), base, set, true);
	random = random.add(Math.floor(Math.random()*1000)%256);
	for(let i=1;i<Limit;i++){
		random = random.multiply(base).add(Math.floor(Math.random()*1000)%256);
	}
	return random;
};

const GeneratePrime = () => {
	let prime = RandomBig();
	for(let i=0;i<354;i++){
		if(prime.isDivisibleBy(2)){
			prime = prime.add(1);
		}
		if(prime.isProbablePrime(50)){
			break;
		}else{
			prime = prime.add(2);
		}
	}
	return prime;
};

RsaKeyGeneration = () => {
	let p = GeneratePrime();
	let q = GeneratePrime();
	let n = p.multiply(q);
	let phi = p.minus(1).multiply(q.minus(1));
	let e = RandomBig().mod(phi.subtract(1)).add(1);
	while(BigInt.gcd(e, phi)!=1){
		e = e.add(1);
	}
	let d = e.modInv(phi);
	return ({public: e.toString(base, set), private: d.toString(base, set), n: n.toString(base, set)});
};

exports.Encryption = (num, obj) => {
	let x = BigInt(num, base, set, true);
	let public = BigInt(obj.public, base, set, true);
	let n = BigInt(obj.n, base, set, true);
	let y = x.modPow(public, n).toString(base, set);
	return y;
};

exports.Decryption = (num, obj) => {
	let y = BigInt(num, base, set, true);
	let private = BigInt(obj.private, base, set, true);
	let n = BigInt(obj.n, base, set, true);
	let z = y.modPow(private, n).toString(base, set);
	return z;
};