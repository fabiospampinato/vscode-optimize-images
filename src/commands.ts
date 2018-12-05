
/* IMPORT */

import * as _ from 'lodash';
import * as opn from 'opn';
import * as path from 'path';
import * as vscode from 'vscode';
import * as walker from 'walker';
import Config from './config';
import Utils from './utils';

/* COMMANDS */

async function optimize () {

  const {workspaceFolders} = vscode.workspace,
        config = Config.get ();

  if ( workspaceFolders && workspaceFolders.length ) {

    const imageRegex = new RegExp ( config.imageRegex, 'i' ),
          images = [];

    for ( let folder of workspaceFolders ) {

      await new Promise ( resolve => {

        const startingPath = path.join ( folder.uri.fsPath, config.searchStartingPath ),
              maxDepth = Utils.path.getDepth ( startingPath ) + config.searchDepth;

        walker ( startingPath )
          .filterDir ( dir => {
            return !_.includes ( config.searchIgnoreFolders, dir ) && !_.includes ( config.searchIgnoreFolders, path.basename ( dir ) ) && Utils.path.getDepth ( dir ) <= maxDepth;
          })
          .on ( 'file', ( file, stat ) => {
            if ( file.match ( imageRegex ) ) {
              images.push ( file );
            }
          })
          .on ( 'error', _.noop )
          .on ( 'end', resolve );

      });

    };

    if ( images.length ) {

      return optimizePaths ( images );

    } else {

      vscode.window.showErrorMessage ( 'No images found' );

    }

  } else {

    vscode.window.showErrorMessage ( 'You have to open at least a folder in order for optimizing its images' );

  }

}

function optimizeFile ( file ) {

  return optimizePaths ( file.path );

}

async function optimizePaths ( paths ) {

  const config = Config.get ();
  const placeholderId = config.appOptions.indexOf( '[filepath]' );

  paths = _.castArray ( paths );

  if ( config.app ) {

    for ( let path of paths ) {

      const input = placeholderId === -1 ? path : '';
      const options = [ ...config.appOptions ];

      if ( placeholderId > -1 ) {

        options.splice( placeholderId, 1, path );

      }

      try {

        await opn( input, { app: [ config.app, ...options ] } ).then( cp => {

          console.log( `[fabiospampinato.vscode-optimize-images] File processed: ${path}; Exit code: ${cp.exitCode}` );

        } );

      } catch ( err ) {

        vscode.window.showErrorMessage( 'Error while processing file: ' + path );

      }
    }

    vscode.window.showInformationMessage( 'Image optimization complete' );

  } else {

    vscode.window.showErrorMessage ( 'You need to provide an app name via the "optimizeImages.app" setting' );

  }

}

/* EXPORT */

export {optimize, optimizeFile, optimizePaths};
