# three-ldraw

## About
The [packLDrawModel utility](https://github.com/mrdoob/three.js/blob/dev/utils/packLDrawModel.mjs) from the [three.js repository](https://github.com/mrdoob/three.js.git) is used to statically link an LDraw model's part file dependencies into one file for optimal rendering via THREE's [LDrawLoader](https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/LDrawLoader.js).

## Bricklink Stud.io Compatibility
Bricklink Stud.io allows exports to the [LDraw file format](https://studiohelp.bricklink.com/hc/en-us/articles/6502197862679-Exporting-to-other-formats#h_01HW3KG3E7E8ZC077CTYTX25E1) expected by THREE's LDrawLoader. However, Bricklink uses non-standard IDs for printed parts, leaving packLDrawModel unable to correctly link in the corresponding LDraw files.

This repo's packLDrawModel.mjs modifies the original utility to handle non-standard Bricklink part IDs by finding equivalent LDraw IDs provided through the [Rebrickable API](https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://rebrickable.com/api/&ved=2ahUKEwjvy5DYhZeKAxVx6ckDHRp4Il0QFnoECA4QAQ&usg=AOvVaw2s1Dcz3neOmEAiGQsZHxYV). If no equivalent exists, the packer defaults to the unprinted version of the part.

## Usage
- Download [official parts library from LDraw.org](https://library.ldraw.org/updates?latest) and unzip in a directory (e.g. ldraw/)
- Download your desired model file and place in the ldraw/models/ subfolder.
- Place this script also in ldraw/
- Create .env file in ldraw/ with the variable API_KEY="yourRebrickableAPIKey"
- Issue command 'node packLDrawModel models/<modelFileName>' or 'node packLDrawModel.mjs models/<modelFileName>'
- The packed object will be in ldraw/models/<modelFileName>_Packed.mpd and will contain all the object subtree as embedded files.
