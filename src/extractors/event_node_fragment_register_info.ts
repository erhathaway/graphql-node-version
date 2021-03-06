import {
    IVersionRecorderExtractors,
    IEventInfoBase,
    IEventNodeFragmentRegisterInfo,
    UnPromisify
} from '../types';

export default <ResolverT extends (...args: any[]) => Promise<any>>(
    node: UnPromisify<ReturnType<ResolverT>>,
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase
): IEventNodeFragmentRegisterInfo | undefined => {
    // tslint:disable-next-line
    const fragmentToRecord = extractors.parentNode
        ? extractors.parentNode(node, args[0], args[1], args[2], args[3])
        : undefined;

    if (!fragmentToRecord) {
        return;
    }

    const fragmentToRecordHasAnError =
        fragmentToRecord &&
        (fragmentToRecord.nodeId === undefined || fragmentToRecord.nodeName === undefined);

    if (fragmentToRecordHasAnError) {
        throw new Error(
            `Missing info found in fragmentToRecord ${JSON.stringify(fragmentToRecord)}`
        );
    }

    return {
        childNodeId: eventInfoBase.nodeId.toString(),
        childNodeName: eventInfoBase.nodeName,
        parentNodeId: fragmentToRecord.nodeId.toString(),
        parentNodeName: fragmentToRecord.nodeName
    };
};
