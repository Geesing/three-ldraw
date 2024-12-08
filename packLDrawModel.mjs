/**
 * LDraw object packer
 *
 * Usage:
 *
 * - Download official parts library from LDraw.org and unzip in a directory (e.g. ldraw/)
 *
 * - Download your desired model file and place in the ldraw/models/ subfolder.
 *
 * - Place this script also in ldraw/
 *
 * - Issue command 'node packLDrawModel models/<modelFileName>'
 *
 * The packed object will be in ldraw/models/<modelFileName>_Packed.mpd and will contain all the object subtree as embedded files.
 *
 *
 */

import dotenv from 'dotenv';
dotenv.config();

const ldrawPath = './';
const materialsFileName = 'LDConfig.ldr';
const apiKey = process.env.API_KEY;


import fs from 'fs';
import path from 'path';

if ( process.argv.length !== 3 ) {

	console.log( 'Usage: node packLDrawModel <modelFilePath>' );
	process.exit( 0 );

}

const fileName = process.argv[ 2 ];

const pathMap = {};
const objectsPaths = [];
const objectsContents = [];
const unsupportedParts = [];

packLDrawModel().catch(err => {
	console.error('Error:', err);
}).then(() => {
	if (unsupportedParts.length > 0) {
		console.warn('Couldn\'t find LDraw equivalents for: ',unsupportedParts);
		console.warn('Some parts may not render correctly.');
	}
})

async function packLDrawModel() {
	const materialsFilePath = path.join( ldrawPath, materialsFileName );

	console.log( 'Loading materials file "' + materialsFilePath + '"...' );
	const materialsContent = fs.readFileSync( materialsFilePath, { encoding: 'utf8' } );

	console.log( 'Packing "' + fileName + '"...' );

	// Parse object tree
	await parseObject( fileName, true );

	// Obtain packed content
	let packedContent = materialsContent + '\n';
	for ( let i = objectsPaths.length - 1; i >= 0; i -- ) {

		packedContent += objectsContents[ i ];

	}

	packedContent += '\n';

	// Save output file
	const outPath = fileName + '_Packed.mpd';
	console.log( 'Writing "' + outPath + '"...' );
	fs.writeFileSync( outPath, packedContent );

	console.log( 'Done.' );
}

async function parseObject( fileName, isRoot ) {

	// Returns the located path for fileName or null if not found

	console.log( 'Adding "' + fileName + '".' );

	const originalFileName = fileName;

	let prefix = '';
	let objectContent = null;
	for ( let attempt = 0; attempt < 2; attempt ++ ) {

		prefix = '';

		if ( attempt === 1 ) {

			fileName = fileName.toLowerCase();

		}

		if ( fileName.startsWith( '48/' ) ) {

			prefix = 'p/';

		} else if ( fileName.startsWith( 's/' ) ) {

			prefix = 'parts/';

		}

		let absoluteObjectPath = path.join( ldrawPath, fileName );

		try {

			objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
			break;

		} catch ( e ) {

			prefix = 'parts/';
			absoluteObjectPath = path.join( ldrawPath, prefix, fileName );

			try {

				objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
				break;

			} catch ( e ) {

				prefix = 'p/';
				absoluteObjectPath = path.join( ldrawPath, prefix, fileName );

				try {

					objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
					break;

				} catch ( e ) {

					try {

						prefix = 'models/';
						absoluteObjectPath = path.join( ldrawPath, prefix, fileName );

						objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
						break;

					} catch ( e ) {

						prefix = '';

						const validExtensions = ['.ldr', '.dat', '.mpd'];

						if ( !isRoot && 
							attempt === 1 && 
							validExtensions.some(ext => originalFileName.endsWith(ext))) {

							const partId = originalFileName.match(/([a-zA-Z0-9]+)(?=\.[a-zA-Z0-9]+$)/)[1];

							const ldraw = await fetchLDrawValue(partId);

							if (!ldraw) {
								fileName = partId.match(/\d+/) + '.dat';
							} else {
								fileName = ldraw + '.dat';
							}

							fileName = await parseObject(fileName, false);

							return fileName;

						}

					}

				}

			}

		}

	}

	const objectPath = path.join( prefix, fileName ).trim().replace( /\\/g, '/' );

	if ( ! objectContent ) {

		// File was not found, but could be a referenced embedded file.
		return objectPath;

	}

	if ( objectContent.indexOf( '\r\n' ) !== - 1 ) {

		// This is faster than String.split with regex that splits on both
		objectContent = objectContent.replace( /\r\n/g, '\n' );

	}

	let processedObjectContent = isRoot ? '' : '0 FILE ' + objectPath + '\n';

	const lines = objectContent.split( '\n' );

	for ( let i = 0, n = lines.length; i < n; i ++ ) {

		let line = lines[ i ];
		let lineLength = line.length;

		// Skip spaces/tabs
		let charIndex = 0;
		while ( ( line.charAt( charIndex ) === ' ' || line.charAt( charIndex ) === '\t' ) && charIndex < lineLength ) {

			charIndex ++;

		}

		line = line.substring( charIndex );
		lineLength = line.length;
		charIndex = 0;


		if ( line.startsWith( '0 FILE ' ) ) {

			if ( i === 0 ) {

				// Ignore first line FILE meta directive
				continue;

			}

			// Embedded object was found, add to path map

			const subobjectFileName = line.substring( charIndex ).trim().replace( /\\/g, '/' );

			if ( subobjectFileName ) {

				// Find name in path cache
				const subobjectPath = pathMap[ subobjectFileName ];

				if ( ! subobjectPath ) {

					pathMap[ subobjectFileName ] = subobjectFileName;

				}

			}

		}

		if ( line.startsWith( '1 ' ) ) {

			// Subobject, add it
			charIndex = 2;

			// Skip material, position and transform
			for ( let token = 0; token < 13 && charIndex < lineLength; token ++ ) {

				// Skip token
				while ( line.charAt( charIndex ) !== ' ' && line.charAt( charIndex ) !== '\t' && charIndex < lineLength ) {

					charIndex ++;

				}

				// Skip spaces/tabs
				while ( ( line.charAt( charIndex ) === ' ' || line.charAt( charIndex ) === '\t' ) && charIndex < lineLength ) {

					charIndex ++;

				}

			}

			const subobjectFileName = line.substring( charIndex ).trim().replace( /\\/g, '/' );

			if ( subobjectFileName ) {

				// Find name in path cache
				let subobjectPath = pathMap[ subobjectFileName ];

				if ( ! subobjectPath ) {

					// Add new object
					subobjectPath = await parseObject( subobjectFileName );
				}

				pathMap[ subobjectPath ] = subobjectPath;

				processedObjectContent += line.substring( 0, charIndex ) + subobjectPath + '\n';

			}

		} else {

			processedObjectContent += line + '\n';

		}

	}

	if ( objectsPaths.indexOf( objectPath ) < 0 ) {

		objectsPaths.push( objectPath );
		objectsContents.push( processedObjectContent );

	}

	return objectPath;

}


async function fetchLDrawValue(partId) {
	const url = `https://rebrickable.com/api/v3/lego/parts/?bricklink_id=`;

	const stdId1 = partId.replace(/bpb/g, 'pb');

	const stdId2 = stdId1.replace(/(\d+)(?!.*\d)/, '0$1');

	try {
		let response = await fetch(url + stdId1, {
			headers: {
					'Authorization': `key ${apiKey}`
				}
		});
		let data = await response.json();
		try {
			const lDrawValue = data.results[0].external_ids.LDraw[0];
			return lDrawValue;
		} catch (error) {
			// Make a second fetch request to url + stdId2 if the first one fails
			response = await fetch(url + stdId2, {
				headers: {
					'Authorization': `key ${apiKey}`
				}
			});
			data = await response.json();
			try {
				const lDrawValue = data.results[0].external_ids.LDraw[0];
				return lDrawValue;
			} catch (error) {
				console.warn(`Warning: part ${partId} not supported by LDraw. File may not render correctly.`);
				unsupportedParts.push(partId);
			}
		}
	} catch (error) {
		console.error('Error:', error);
	}
}