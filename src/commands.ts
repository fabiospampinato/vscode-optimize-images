
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

  if ( !config.app ) {

    vscode.window.showErrorMessage ( '[OptimizeImages] You need to provide an app name via the "optimizeImages.app" setting' );

  } else if (
    !config.appUseFilePathAsArgument &&
    !config.appOptions.filter(option => option.includes('{{filepath}}')).length
  ) {

    vscode.window.showErrorMessage( '[OptimizeImages] If you don\'t use the filepath as argument you have to specify an option which uses the {{filepath}} placeholder.' );

  } else {
    paths = _.castArray ( paths );

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Optimize images',
        cancellable: true
      },
      async ( progress, token ) => {

        const processing = [];
        const step = 100 / paths.length

        token.onCancellationRequested(() => {

          vscode.window.showInformationMessage ( '[OptimizeImages] Image optimization cancelled ' );

        } );

        for ( let path of paths ) {

          const input = config.appUseFilePathAsArgument ? path : '';

          processing.push(
            await opn ( input, {
                app: [
                  config.app,
                  ...config.appOptions.map (
                    option => option.replace( '{{filepath}}', path )
                  )
                ]
              } )
              .then( () => {

                progress.report( {
                  increment: step,
                  message: processing.length + ' / ' + paths.length + '\n' + path
                } );

                return path;

              } )
              .catch( err => {

                vscode.window.showErrorMessage( '[OptimizeImages] Error while processing file: ' + path );

              } )
          );
        }

        return processing;

      }
    )
    .then ( processed => {

      vscode.window.showInformationMessage( '[OptimizeImages] Image optimization complete\nCheck the debug console for more information.' );

      console.log ( `[OptimizeImages] The following images have been processed:\n${processed.join('\n')}` );

    } );

  }
}

/* EXPORT */

export {optimize, optimizeFile, optimizePaths};
