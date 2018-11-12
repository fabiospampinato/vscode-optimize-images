
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

function optimizePaths ( paths ) {

  const config = Config.get ();
  const useOptions = !!config.appOptions.find( option => option.includes( '[filepath]' ) );

  if ( !config.app ) {

    vscode.window.showErrorMessage ( 'You need to provide an app name via the "optimizeImages.app" setting' );

  } else {

    paths = _.castArray ( paths );

    const windowOpts = {
      location: vscode.ProgressLocation.Notification,
      title: 'Optimize images',
      cancellable: true
    };

    vscode.window.withProgress( windowOpts, async ( progress, token ) => {

      const processed = [];
      const increment = 100 / paths.length

      progress.report( { increment: 0 } );

      token.onCancellationRequested(() => {

        vscode.window.showInformationMessage ( 'Image optimization cancelled ' );

      } );

      for ( let path of paths ) {

        const input = useOptions ? '' : path;

        try {

          await opn (input, { app: [ config.app, ...config.appOptions.map (

            option => option.replace( '[filepath]', path )

          ) ] } );

          processed.push(path);

          progress.report( { increment, message: `${processed.length} / ${paths.length}\n${path}` } );

        } catch ( err ) {

          vscode.window.showErrorMessage( 'Error while processing file: ' + path );

        }
      }

      return processed;

    } ).then ( processed => {

      vscode.window.showInformationMessage( 'Image optimization complete.' );

      console.log ( `The following images have been processed:\n${processed.join('\n')}` );

    } );

  }
}

/* EXPORT */

export {optimize, optimizeFile, optimizePaths};
