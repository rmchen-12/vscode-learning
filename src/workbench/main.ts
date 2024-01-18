import { Disposable } from 'src/base/common/lifecycle';
import { mark } from 'src/base/common/performance';
import { ServiceCollection } from 'src/platform/instantiation/serviceCollection';
import { IMainProcessService, IMainAppService, ISharedProcessService, registerMainProcessRemoteService, registerSharedProcessRemoteService, registerMainAppRemoteService } from 'src/platform/ipc/electron-sandbox/services';
import { SharedProcessService } from './services/sharedProcess/electron-sandbox/sharedProcessService';
import { MainAppService } from './services/mainApp/electron-sandbox/mainAppService';
import { MainProcessService } from './services/mainProcess/electron-sandbox/mainProcessService';
import { IInstantiationService, ServicesAccessor } from 'src/platform/instantiation/instantiation';
import { InstantiationService } from 'src/platform/instantiation/instantiationService';
import { setGlobalLeakWarningThreshold } from 'src/base/common/event';
import { getSingletonServiceDescriptors } from 'src/platform/instantiation/extensions';
import { IAuthenticationService } from 'src/platform/authentication/electron-sandbox/authentication';
import { ILoggerService } from 'src/platform/logger/common/logger';
import { services, servicesRegistry } from './services';
import { ITickTimerService } from 'src/platform/tickTimer/common/tickTimer';

interface IConfig {
  services: ('logger' | 'tickTimer' | 'authentication')[];
}

type RenderCallback = (accessor: ServicesAccessor) => Promise<void> | void;

export class Workbench extends Disposable {
  declare readonly _serviceBrand: undefined;

  constructor(private readonly config: IConfig, private readonly serviceCollection: ServiceCollection) {
    super();
  }

  startup(render: RenderCallback): IInstantiationService {
    // Configure emitter leak warning threshold
    setGlobalLeakWarningThreshold(175);

    // Services
    const instantiationService = this.initServices(this.serviceCollection);

    instantiationService.invokeFunction(async (accessor) => {
      // const lifecycleService = accessor.get(ILifecycleService);

      const authenticationService = accessor.get(IAuthenticationService);
      const loggerService = accessor.get(ILoggerService);
      // const tickTimerService = accessor.get(ITickTimerService);

      authenticationService.login(1).then((e) => console.log(e));

      services.logger.error('bosszp', 'jlkjlkj');
      // console.time('获取主进程数据');
      // authenticationService.getList().then((e) => {
      //   // console.timeEnd('获取主进程数据');
      //   // console.log('e', e);

      //   console.log('start', Date.now());

      //   tickTimerService.spm('sasdf1').then((e) => {
      //     // console.log(e);
      //     // console.timeEnd('asdf');
      //   });
      // });

      loggerService.error('bosszp', 'asdf');

      // tickTimerService.spm('spm').then(console.log);

      // 执行 new vue()
      await render(accessor);
    });

    return instantiationService;
  }

  private registerListeners(): void {}

  private initServices(serviceCollection: ServiceCollection): IInstantiationService {
    // Layout Service
    // serviceCollection.set(IWorkbenchLayoutService, this);

    if (this.config.services.includes('authentication')) {
      registerMainProcessRemoteService(IAuthenticationService, 'authentication', { supportsDelayedInstantiation: true });
    }

    if (this.config.services.includes('logger')) {
      registerSharedProcessRemoteService(ILoggerService, 'logger', { supportsDelayedInstantiation: true });
    }

    if (this.config.services.includes('tickTimer')) {
      registerMainAppRemoteService(ITickTimerService, 'tickTimer', { supportsDelayedInstantiation: true });
    }

    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    //
    // NOTE: Please do NOT register services here. Use `registerSingleton()`
    //       from `importServices.ts`
    //
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    // All Contributed Services
    const contributedServices = getSingletonServiceDescriptors();
    for (let [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }

    const instantiationService = new InstantiationService(serviceCollection, true);

    // Wrap up
    instantiationService.invokeFunction((accessor) => {
      // NativeWorkbenchEnvironmentService 加入 servicesRegistry 中
      // servicesRegistry.add(INativeWorkbenchEnvironmentService, serviceCollection.get(INativeWorkbenchEnvironmentService));

      // 将注册的服务都加入 servicesRegistry 中
      for (let [id, descriptor] of contributedServices) {
        servicesRegistry.add(id, accessor.get(id));
      }
    });

    return instantiationService;
  }
}

class Main extends Disposable {
  constructor() {
    super();

    this.init();
  }

  private init(): void {
    // Browser config
  }

  async open(config: IConfig, render: RenderCallback) {
    const services = await this.initServices();

    // await domContentLoaded();
    mark('code/willStartWorkbench');

    // Create Workbench
    const workbench = new Workbench(config, services.serviceCollection);

    // Listeners
    this.registerListeners(workbench);

    // Startup
    const instantiationService = workbench.startup(render);

    // Return API Facade
    instantiationService.invokeFunction((accessor) => {});
  }

  private async initServices(): Promise<{ serviceCollection: ServiceCollection }> {
    const serviceCollection = new ServiceCollection();

    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // NOTE: DO NOT ADD ANY OTHER SERVICE INTO THE COLLECTION HERE.
    // CONTRIBUTE IT VIA WORKBENCH.WEB.MAIN.TS AND registerSingleton().
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    // Main Process
    const mainProcessService = new MainProcessService(1);
    serviceCollection.set(IMainProcessService, mainProcessService);

    // Shared Process
    const sharedProcessService = new SharedProcessService(1);
    serviceCollection.set(ISharedProcessService, sharedProcessService);

    // MainApp
    const mainAppService = new MainAppService(1);
    serviceCollection.set(IMainAppService, mainAppService);

    return { serviceCollection };
  }

  private registerListeners(workbench: Workbench): void {}
}

console.time('render');

const connect = new Main();

connect.open(
  {
    services: ['logger', 'authentication'],
  },
  (accesser) => {
    console.timeEnd('render');
    document.body.innerHTML = '123123';
  }
);
